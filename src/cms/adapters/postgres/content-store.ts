import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool, PoolClient } from "pg";
import type { PreparedSnapshot, Reference, ReferenceKind, ReferenceOccurrence } from "../../services/types";

export class CmsError extends Error {
	public readonly code: string;
	public readonly serverVersion?: number;

	constructor(message: string, code: string, serverVersion?: number) {
		super(message);
		this.code = code;
		this.serverVersion = serverVersion;
		this.name = "CmsError";
	}
}

export type JsonPrimitive = string | number | boolean | null;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
	[key: string]: JsonValue;
}
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type EntryMetadata = JsonObject;

export interface EntryBody {
	metadata: EntryMetadata;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
}

export interface Entry {
	id: string;
	collection: string;
	version: number;
	createdAt: Date;
	updatedAt: Date;
	firstPublishedAt?: Date;
	lastPublishedAt?: Date;
	publishedAt?: Date;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: EntryBody;
	published?: EntryBody;
}

export interface CreateEntryInput {
	collection: string;
	slug: string | null;
	metadata: unknown;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
}

export interface SaveWorkingInput {
	expectedVersion: number;
	slug?: string | null;
	metadata: unknown;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
}

export interface PublishEntryInput {
	expectedVersion: number;
}

export type ContentStoreHooks = {
	beforePublishCommit?: (entry: Entry, txClient: PoolClient) => Promise<void>;
};

function validateSchemaName(schema?: string): string {
	const s = schema ?? "public";
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
		throw new Error("Invalid schema name");
	}
	return s;
}

export async function migrateContentStore(pool: Pool, options?: { schema?: string }): Promise<void> {
	const qSchema = validateSchemaName(options?.schema);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS "${qSchema}".entries (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			version INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			first_published_at TIMESTAMPTZ,
			last_published_at TIMESTAMPTZ,
			published_at TIMESTAMPTZ,
			working_slug TEXT
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".entry_bodies (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			metadata JSONB NOT NULL,
			mdx TEXT NOT NULL,
			schema_version INTEGER NOT NULL,
			content_hash TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL,
			PRIMARY KEY (entry_id, state)
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".content_addresses (
			collection TEXT NOT NULL,
			slug TEXT NOT NULL,
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			type TEXT NOT NULL CHECK (type IN ('reservation', 'current', 'alias', 'deleted')),
			PRIMARY KEY (collection, slug)
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".media_assets (
			id UUID PRIMARY KEY
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".entry_references (
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			state TEXT NOT NULL CHECK (state IN ('working', 'published')),
			kind TEXT NOT NULL CHECK (kind IN ('entry', 'media', 'category', 'tag')),
			target_id UUID NOT NULL,
			target_entry_id UUID REFERENCES "${qSchema}".entries(id),
			target_media_id UUID REFERENCES "${qSchema}".media_assets(id),
			is_stale BOOLEAN NOT NULL,
			occurrences JSONB NOT NULL,
			UNIQUE (entry_id, state, kind, target_id),
			CHECK (
				(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
				(kind IN ('entry', 'category', 'tag') AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
			)
		);
	`);
}

function normalizeJsonValue(val: unknown): JsonValue {
	if (val === null) return null;
	if (typeof val === "string" || typeof val === "boolean") return val;
	if (typeof val === "number") {
		if (!Number.isFinite(val)) throw new CmsError("Non-finite number", "invalid_input");
		return val;
	}
	if (Array.isArray(val)) {
		return val.map((v) => normalizeJsonValue(v));
	}
	if (typeof val === "object") {
		if (Object.getPrototypeOf(val) !== Object.prototype && Object.getPrototypeOf(val) !== null) {
			throw new CmsError("Invalid object type", "invalid_input");
		}
		const obj: JsonObject = {};
		for (const key of Object.keys(val).sort()) {
			Object.defineProperty(obj, key, {
				value: normalizeJsonValue((val as Record<string, unknown>)[key]),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
		return obj;
	}
	throw new CmsError(`Invalid JSON type: ${typeof val}`, "invalid_input");
}

export function normalizeMetadata(input: unknown): EntryMetadata {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new CmsError("Metadata must be a JSON object", "invalid_input");
	}
	if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
		throw new CmsError("Metadata must be a plain object", "invalid_input");
	}
	return normalizeJsonValue(input) as EntryMetadata;
}

interface EntryRow {
	id: string;
	collection: string;
	version: number;
	created_at: Date;
	entry_updated_at: Date;
	first_published_at: Date | null;
	last_published_at: Date | null;
	published_at: Date | null;
	working_slug: string | null;
	current_slug: string | null;
	state: "working" | "published" | null;
	metadata: EntryMetadata | null;
	mdx: string | null;
	schema_version: number | null;
	content_hash: string | null;
	body_updated_at: Date | null;
}

interface VersionRow {
	version: number;
}

interface BodyRow {
	content_hash: string;
	mdx: string;
	schema_version: number;
	metadata: EntryMetadata;
	updated_at: Date;
}

interface ReferenceRow {
	kind: ReferenceKind;
	target_id: string;
	is_stale: boolean;
	occurrences: readonly ReferenceOccurrence[];
}

async function loadEntry(client: Pool | PoolClient, id: string, qSchema: string): Promise<Entry> {
	const res = await client.query<EntryRow>(
		`SELECT
			e.id, e.collection, e.version, e.created_at, e.updated_at as entry_updated_at,
			e.first_published_at, e.last_published_at, e.published_at, e.working_slug,
			(SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = e.id AND type = 'current') as current_slug,
			b.state, b.metadata, b.mdx, b.schema_version, b.content_hash, b.updated_at as body_updated_at
		 FROM "${qSchema}".entries e
		 LEFT JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id
		 WHERE e.id = $1`,
		[id],
	);

	if (res.rows.length === 0) {
		throw new CmsError("Entry not found", "not_found");
	}

	const first = res.rows[0];
	const publishedSlug = first.current_slug ?? null;
	const workingSlug = first.working_slug;

	let working: EntryBody | undefined;
	let published: EntryBody | undefined;

	for (const row of res.rows) {
		if (
			row.state !== null &&
			row.metadata !== null &&
			row.mdx !== null &&
			row.schema_version !== null &&
			row.content_hash !== null &&
			row.body_updated_at !== null
		) {
			const body: EntryBody = {
				metadata: row.metadata,
				mdx: row.mdx,
				schemaVersion: row.schema_version,
				contentHash: row.content_hash,
				updatedAt: row.body_updated_at,
			};
			if (row.state === "working") {
				working = body;
			} else if (row.state === "published") {
				published = body;
			}
		}
	}

	if (!working) {
		throw new CmsError("Entry missing working state", "invalid_state");
	}

	return {
		id: first.id,
		collection: first.collection,
		version: first.version,
		createdAt: first.created_at,
		updatedAt: first.entry_updated_at,
		firstPublishedAt: first.first_published_at ?? undefined,
		lastPublishedAt: first.last_published_at ?? undefined,
		publishedAt: first.published_at ?? undefined,
		workingSlug,
		publishedSlug,
		working,
		published,
	};
}

function isReferencesEqual(a: readonly Reference[], b: readonly Reference[]): boolean {
	if (a.length !== b.length) return false;
	const key = (r: Reference) => `${r.kind}:${r.targetId.toLowerCase()}`;
	const mapA = new Map(a.map((r) => [key(r), r]));
	const mapB = new Map(b.map((r) => [key(r), r]));
	if (mapA.size !== mapB.size) return false;
	for (const [k, refA] of mapA.entries()) {
		const refB = mapB.get(k);
		if (!refB) return false;
		if (refA.isStale !== refB.isStale) return false;
		if (!isDeepStrictEqual(refA.occurrences, refB.occurrences)) return false;
	}
	return true;
}

function isWorkingSlugConflict(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === "23505" &&
		"constraint" in err &&
		err.constraint === "content_addresses_pkey"
	);
}

export function createContentStore(
	pool: Pool,
	options?: { schema?: string; beforePublishCommit?: ContentStoreHooks["beforePublishCommit"] },
) {
	const qSchema = validateSchemaName(options?.schema);
	const hooks = { beforePublishCommit: options?.beforePublishCommit };

	return {
		createEntryWithReferences: async (params: {
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
		}): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(params.snapshot.metadata);
				await client.query("BEGIN");
				const id = randomUUID();
				const version = 1;
				const now = new Date();

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[id, params.snapshot.collection, version, now, now, params.snapshot.slug],
				);

				await client.query(
					`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at)
					 VALUES ($1, 'working', $2, $3, $4, $5, $6)`,
					[
						id,
						JSON.stringify(metadata),
						params.snapshot.mdx,
						params.snapshot.schemaVersion,
						params.snapshot.contentHash,
						now,
					],
				);

				if (params.snapshot.slug !== null) {
					await client.query(
						`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type)
						 VALUES ($1, $2, $3, 'reservation')`,
						[params.snapshot.collection, params.snapshot.slug, id],
					);
				}

				for (const ref of params.references) {
					const targetEntryId =
						ref.kind === "entry" || ref.kind === "category" || ref.kind === "tag" ? ref.targetId : null;
					const targetMediaId = ref.kind === "media" ? ref.targetId : null;
					await client.query(
						`INSERT INTO "${qSchema}".entry_references
						 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
						 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
						[id, ref.kind, ref.targetId, targetEntryId, targetMediaId, ref.isStale, JSON.stringify(ref.occurrences)],
					);
				}

				const entry = await loadEntry(client, id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				if (isWorkingSlugConflict(err)) {
					throw new CmsError("Slug conflict", "slug_conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		saveWorkingWithReferences: async (params: {
			entryId: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
		}): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(params.snapshot.metadata);
				await client.query("BEGIN");
				const res = await client.query<{ version: number; collection: string }>(
					`SELECT version, collection FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.entryId],
				);
				if (res.rows.length === 0) {
					throw new CmsError("Entry not found", "not_found");
				}

				const currentVersion = res.rows[0].version;
				const currentCollection = res.rows[0].collection;

				if (currentCollection !== params.snapshot.collection) {
					throw new CmsError("Collection mismatch", "invalid_input");
				}

				if (currentVersion !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", currentVersion);
				}

				const bodyRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[params.entryId],
				);

				const currentSlugRes = await client.query<{ slug: string }>(
					`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
					[params.entryId],
				);
				const currentSlug = currentSlugRes.rows.length > 0 ? currentSlugRes.rows[0].slug : null;

				const entryMetaRes = await client.query<{ working_slug: string | null }>(
					`SELECT working_slug FROM "${qSchema}".entries WHERE id = $1`,
					[params.entryId],
				);
				const currentWorkingSlug = entryMetaRes.rows[0].working_slug;
				const nextWorkingSlug = params.snapshot.slug !== undefined ? params.snapshot.slug : currentWorkingSlug;

				const currentRefsRes = await client.query<ReferenceRow>(
					`SELECT kind, target_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $1 AND state = 'working'`,
					[params.entryId],
				);
				const currentRefs: Reference[] = currentRefsRes.rows.map((row) => ({
					kind: row.kind,
					targetId: row.target_id,
					isStale: row.is_stale,
					occurrences: row.occurrences,
				}));

				const refsEqual = isReferencesEqual(currentRefs, params.references);

				let isBodyIdentical = false;
				if (bodyRes.rows.length > 0) {
					const curr = bodyRes.rows[0];
					if (
						curr.content_hash === params.snapshot.contentHash &&
						curr.mdx === params.snapshot.mdx &&
						curr.schema_version === params.snapshot.schemaVersion &&
						currentWorkingSlug === nextWorkingSlug &&
						isDeepStrictEqual(curr.metadata, metadata)
					) {
						isBodyIdentical = true;
					}
				}

				if (isBodyIdentical && refsEqual) {
					const entry = await loadEntry(client, params.entryId, qSchema);
					await client.query("COMMIT");
					return entry;
				}

				const newVersion = currentVersion + 1;
				const now = new Date();

				if (!isBodyIdentical) {
					await client.query(
						`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3 WHERE id = $4`,
						[newVersion, now, nextWorkingSlug, params.entryId],
					);

					if (bodyRes.rows.length > 0) {
						await client.query(
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5 WHERE entry_id = $6 AND state = 'working'`,
							[
								JSON.stringify(metadata),
								params.snapshot.mdx,
								params.snapshot.schemaVersion,
								params.snapshot.contentHash,
								now,
								params.entryId,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at) VALUES ($1, 'working', $2, $3, $4, $5, $6)`,
							[
								params.entryId,
								JSON.stringify(metadata),
								params.snapshot.mdx,
								params.snapshot.schemaVersion,
								params.snapshot.contentHash,
								now,
							],
						);
					}

					if (params.snapshot.slug !== undefined) {
						await client.query(
							`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`,
							[params.entryId],
						);

						if (params.snapshot.slug !== null && params.snapshot.slug !== currentSlug) {
							const colRes = await client.query<{ collection: string }>(
								`SELECT collection FROM "${qSchema}".entries WHERE id = $1`,
								[params.entryId],
							);
							if (colRes.rows.length > 0) {
								await client.query(
									`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type) VALUES ($1, $2, $3, 'reservation')`,
									[colRes.rows[0].collection, params.snapshot.slug, params.entryId],
								);
							}
						}
					}
				} else {
					await client.query(`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2 WHERE id = $3`, [
						newVersion,
						now,
						params.entryId,
					]);
				}

				if (!refsEqual) {
					await client.query(`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'working'`, [
						params.entryId,
					]);

					for (const ref of params.references) {
						const targetEntryId =
							ref.kind === "entry" || ref.kind === "category" || ref.kind === "tag" ? ref.targetId : null;
						const targetMediaId = ref.kind === "media" ? ref.targetId : null;
						await client.query(
							`INSERT INTO "${qSchema}".entry_references
							 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
							 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
							[
								params.entryId,
								ref.kind,
								ref.targetId,
								targetEntryId,
								targetMediaId,
								ref.isStale,
								JSON.stringify(ref.occurrences),
							],
						);
					}
				}

				const entry = await loadEntry(client, params.entryId, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				if (isWorkingSlugConflict(err)) {
					throw new CmsError("Slug conflict", "slug_conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		getWorkingReferences: async (params: { entryId: string }): Promise<Reference[]> => {
			const res = await pool.query<ReferenceRow>(
				`SELECT kind, target_id, is_stale, occurrences
				 FROM "${qSchema}".entry_references
				 WHERE entry_id = $1 AND state = 'working'
				 ORDER BY kind ASC, target_id ASC`,
				[params.entryId],
			);
			return res.rows.map((row) => ({
				kind: row.kind,
				targetId: row.target_id,
				isStale: row.is_stale,
				occurrences: row.occurrences,
			}));
		},

		createEntry: async (data: CreateEntryInput): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(data.metadata);
				await client.query("BEGIN");
				const id = randomUUID();
				const version = 1;
				const now = new Date();

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[id, data.collection, version, now, now, data.slug],
				);

				await client.query(
					`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at)
					 VALUES ($1, 'working', $2, $3, $4, $5, $6)`,
					[id, JSON.stringify(metadata), data.mdx, data.schemaVersion, data.contentHash, now],
				);

				if (data.slug !== null) {
					await client.query(
						`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type)
						 VALUES ($1, $2, $3, 'reservation')`,
						[data.collection, data.slug, id],
					);
				}

				const entry = await loadEntry(client, id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		getEntry: async (id: string): Promise<Entry> => {
			return await loadEntry(pool, id, qSchema);
		},

		saveWorking: async (id: string, data: SaveWorkingInput): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(data.metadata);
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[id],
				);
				if (res.rows.length === 0) {
					throw new CmsError("Entry not found", "not_found");
				}

				const currentVersion = res.rows[0].version;

				if (currentVersion !== data.expectedVersion) {
					throw new CmsError("Conflict", "conflict", currentVersion);
				}

				const bodyRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[id],
				);

				const currentSlugRes = await client.query<{ slug: string }>(
					`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
					[id],
				);
				const currentSlug = currentSlugRes.rows.length > 0 ? currentSlugRes.rows[0].slug : null;

				const entryMetaRes = await client.query<{ working_slug: string | null }>(
					`SELECT working_slug FROM "${qSchema}".entries WHERE id = $1`,
					[id],
				);
				const currentWorkingSlug = entryMetaRes.rows[0].working_slug;
				const nextWorkingSlug = data.slug !== undefined ? data.slug : currentWorkingSlug;

				let isIdentical = false;
				if (bodyRes.rows.length > 0) {
					const curr = bodyRes.rows[0];
					if (
						curr.content_hash === data.contentHash &&
						curr.mdx === data.mdx &&
						curr.schema_version === data.schemaVersion &&
						currentWorkingSlug === nextWorkingSlug &&
						isDeepStrictEqual(curr.metadata, metadata)
					) {
						isIdentical = true;
					}
				}

				if (!isIdentical) {
					const newVersion = currentVersion + 1;
					const now = new Date();
					await client.query(
						`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3 WHERE id = $4`,
						[newVersion, now, nextWorkingSlug, id],
					);

					if (bodyRes.rows.length > 0) {
						await client.query(
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5 WHERE entry_id = $6 AND state = 'working'`,
							[JSON.stringify(metadata), data.mdx, data.schemaVersion, data.contentHash, now, id],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at) VALUES ($1, 'working', $2, $3, $4, $5, $6)`,
							[id, JSON.stringify(metadata), data.mdx, data.schemaVersion, data.contentHash, now],
						);
					}

					if (data.slug !== undefined) {
						await client.query(
							`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`,
							[id],
						);

						if (data.slug !== null && data.slug !== currentSlug) {
							const colRes = await client.query<{ collection: string }>(
								`SELECT collection FROM "${qSchema}".entries WHERE id = $1`,
								[id],
							);
							if (colRes.rows.length > 0) {
								await client.query(
									`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type) VALUES ($1, $2, $3, 'reservation')`,
									[colRes.rows[0].collection, data.slug, id],
								);
							}
						}
					}
				}

				const entry = await loadEntry(client, id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		publishEntry: async (id: string, data: PublishEntryInput): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[id],
				);
				if (res.rows.length === 0) {
					throw new CmsError("Entry not found", "not_found");
				}

				const currentVersion = res.rows[0].version;
				if (currentVersion !== data.expectedVersion) {
					throw new CmsError("Conflict", "conflict", currentVersion);
				}

				const bodyRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[id],
				);

				if (bodyRes.rows.length === 0) {
					throw new CmsError("Working draft not found", "not_found");
				}

				const working = bodyRes.rows[0];

				const pubRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'published'`,
					[id],
				);

				const entryRes = await client.query<{
					first_published_at: Date | null;
					collection: string;
					working_slug: string | null;
				}>(`SELECT first_published_at, collection, working_slug FROM "${qSchema}".entries WHERE id = $1`, [id]);
				const collection = entryRes.rows[0].collection;
				const firstPublishedAt = entryRes.rows[0].first_published_at;
				const targetSlug = entryRes.rows[0].working_slug;

				const currentSlugRes = await client.query<{ slug: string }>(
					`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
					[id],
				);
				const currentSlug = currentSlugRes.rows.length > 0 ? currentSlugRes.rows[0].slug : null;

				let isRepublish = false;
				if (pubRes.rows.length > 0) {
					const pub = pubRes.rows[0];
					if (
						pub.content_hash === working.content_hash &&
						pub.mdx === working.mdx &&
						pub.schema_version === working.schema_version &&
						pub.updated_at.getTime() === working.updated_at.getTime() &&
						currentSlug === targetSlug &&
						isDeepStrictEqual(pub.metadata, working.metadata)
					) {
						isRepublish = true;
					}
				}

				if (!isRepublish) {
					const newVersion = currentVersion + 1;
					const now = new Date();

					if (!firstPublishedAt) {
						await client.query(
							`UPDATE "${qSchema}".entries SET version = $1, last_published_at = $2, first_published_at = $3, published_at = $4 WHERE id = $5`,
							[newVersion, now, now, now, id],
						);
					} else {
						await client.query(`UPDATE "${qSchema}".entries SET version = $1, last_published_at = $2 WHERE id = $3`, [
							newVersion,
							now,
							id,
						]);
					}

					if (pubRes.rows.length > 0) {
						await client.query(
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5 WHERE entry_id = $6 AND state = 'published'`,
							[
								JSON.stringify(working.metadata),
								working.mdx,
								working.schema_version,
								working.content_hash,
								working.updated_at,
								id,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at) VALUES ($1, 'published', $2, $3, $4, $5, $6)`,
							[
								id,
								JSON.stringify(working.metadata),
								working.mdx,
								working.schema_version,
								working.content_hash,
								working.updated_at,
							],
						);
					}

					await client.query(
						`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`,
						[id],
					);

					if (currentSlug !== null && currentSlug !== targetSlug) {
						await client.query(
							`UPDATE "${qSchema}".content_addresses SET type = 'alias' WHERE entry_id = $1 AND type = 'current'`,
							[id],
						);
					}

					if (targetSlug !== null && targetSlug !== currentSlug) {
						await client.query(
							`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type) VALUES ($1, $2, $3, 'current')`,
							[collection, targetSlug, id],
						);
					}
				}

				const entry = await loadEntry(client, id, qSchema);

				if (hooks.beforePublishCommit) {
					await hooks.beforePublishCommit(entry, client);
				}

				await client.query("COMMIT");

				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},
	};
}
