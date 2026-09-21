import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool, PoolClient, QueryResult } from "pg";
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

export interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
	version: number;
}

export interface ListEntriesItem {
	id: string;
	collection: string;
	title: string | null;
	slug: string | null;
	status: "draft" | "published";
	folderId: string | null;
	categoryId: string | null;
	tagIds: readonly string[];
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ListEntriesParams {
	collection: string;
	search?: string;
	includeBody?: boolean;
	statuses?: readonly ("draft" | "published")[];
	folderId?: string | null;
	includeDescendants?: boolean;
	sort?: {
		field: "updatedAt" | "createdAt" | "title" | "slug";
		direction: "asc" | "desc";
	};
	page?: number;
	pageSize?: 25 | 50 | 100;
}

export interface ListEntriesResult {
	items: ListEntriesItem[];
	total: number;
	page: number;
	pageSize: number;
}

function extractVisibleText(mdx: string): string {
	if (!mdx) return "";
	let t = mdx;
	// 1. strip MDX/JSX comments: {/* ... */}
	t = t.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
	// 2. strip HTML comments: <!-- ... -->
	t = t.replace(/<!--[\s\S]*?-->/g, " ");
	// 3. strip JS/MDX exports and imports (single line or multiline)
	t = t.replace(/^\s*(?:export|import)\b[\s\S]*?;(?:\r?\n|$)/gm, " ");
	// 4. strip markdown links [label](url) -> label (and images ![alt](url) -> alt)
	t = t.replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1");
	// 5. strip HTML/JSX tags while allowing attributes with quotes that may contain >
	t = t.replace(/<[a-zA-Z0-9_/][^>"\x27]*(?:"[^"]*"|\x27[^\x27]*\x27|[^>"\x27]*)*>/g, " ");
	return t;
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
		CREATE TABLE IF NOT EXISTS "${qSchema}".folders (
			id UUID PRIMARY KEY,
			collection TEXT NOT NULL,
			parent_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION,
			name TEXT NOT NULL,
			position INTEGER NOT NULL,
			version INTEGER NOT NULL DEFAULT 1
		);

		ALTER TABLE "${qSchema}".folders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

		CREATE UNIQUE INDEX IF NOT EXISTS folders_sibling_name_idx ON "${qSchema}".folders(
			collection,
			name,
			COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
		);

		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES "${qSchema}".folders(id) ON DELETE NO ACTION;

		ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';

		CREATE TABLE IF NOT EXISTS "${qSchema}".user_preferences (
			user_id TEXT PRIMARY KEY,
			preferences JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);
	`);

	// Backfill rows where search_text IS NULL
	// (search_text column defaults to empty string, but for newly added columns
	// or existing rows without search_text populated)
	interface BackfillRow {
		entry_id: string;
		state: string;
		mdx: string;
	}
	const unmigratedRes = await pool.query<BackfillRow>(
		`SELECT entry_id, state, mdx FROM "${qSchema}".entry_bodies WHERE search_text IS NULL`,
	);
	for (const row of unmigratedRes.rows) {
		const visible = extractVisibleText(row.mdx);
		await pool.query(`UPDATE "${qSchema}".entry_bodies SET search_text = $1 WHERE entry_id = $2 AND state = $3`, [
			visible,
			row.entry_id,
			row.state,
		]);
	}
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

export interface FolderRow {
	id: string;
	collection: string;
	parent_id: string | null;
	name: string;
	position: number;
	version: number;
}

export interface IncomingReferenceItem {
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	sourceSlug: string | null;
	kind: ReferenceKind;
	isStale: boolean;
	occurrences: readonly ReferenceOccurrence[];
}

export type ContentStore = ReturnType<typeof createContentStore>;

interface ListEntryRow {
	id: string;
	collection: string;
	folder_id: string | null;
	created_at: Date;
	updated_at: Date;
	published_at: Date | null;
	working_slug: string | null;
	title: string | null;
	is_published: boolean;
	category_id: string | null;
	tag_ids: string[] | null;
}

interface CountRow {
	count: string;
}

interface DescFolderRow {
	id: string;
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

function isFolderSiblingConflict(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === "23505" &&
		"constraint" in err &&
		err.constraint === "folders_sibling_name_idx"
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
			folderId?: string | null;
		}): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(params.snapshot.metadata);
				await client.query("BEGIN");
				const id = randomUUID();
				const version = 1;
				const now = new Date();

				if (params.folderId) {
					const fRes = await client.query<{ collection: string }>(
						`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
						[params.folderId],
					);
					if (fRes.rows.length === 0 || fRes.rows[0].collection !== params.snapshot.collection) {
						throw new CmsError("Invalid folder", "invalid_input");
					}
				}

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id)
					 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[id, params.snapshot.collection, version, now, now, params.snapshot.slug, params.folderId ?? null],
				);

				await client.query(
					`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text)
					 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
					[
						id,
						JSON.stringify(metadata),
						params.snapshot.mdx,
						params.snapshot.schemaVersion,
						params.snapshot.contentHash,
						now,
						extractVisibleText(params.snapshot.mdx),
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
			folderId?: string | null;
		}): Promise<Entry> => {
			const client = await pool.connect();
			try {
				const metadata = normalizeMetadata(params.snapshot.metadata);
				await client.query("BEGIN");
				const res = await client.query<{ version: number; collection: string; updated_at: Date }>(
					`SELECT version, collection, updated_at FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
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

				if (params.folderId) {
					const fRes = await client.query<{ collection: string }>(
						`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
						[params.folderId],
					);
					if (fRes.rows.length === 0 || fRes.rows[0].collection !== params.snapshot.collection) {
						throw new CmsError("Invalid folder", "invalid_input");
					}
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

				const folderChanged = params.folderId !== undefined;

				if (isBodyIdentical && refsEqual && !folderChanged) {
					const entry = await loadEntry(client, params.entryId, qSchema);
					await client.query("COMMIT");
					return entry;
				}

				const newVersion = currentVersion + 1;
				const now = new Date();

				if (!isBodyIdentical || folderChanged) {
					if (params.folderId !== undefined) {
						await client.query(
							`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3, folder_id = $4 WHERE id = $5`,
							[
								newVersion,
								isBodyIdentical ? res.rows[0].updated_at : now,
								nextWorkingSlug,
								params.folderId ?? null,
								params.entryId,
							],
						);
					} else {
						await client.query(
							`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3 WHERE id = $4`,
							[newVersion, now, nextWorkingSlug, params.entryId],
						);
					}

					if (bodyRes.rows.length > 0) {
						await client.query(
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5, search_text = $6 WHERE entry_id = $7 AND state = 'working'`,
							[
								JSON.stringify(metadata),
								params.snapshot.mdx,
								params.snapshot.schemaVersion,
								params.snapshot.contentHash,
								now,
								extractVisibleText(params.snapshot.mdx),
								params.entryId,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text) VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
							[
								params.entryId,
								JSON.stringify(metadata),
								params.snapshot.mdx,
								params.snapshot.schemaVersion,
								params.snapshot.contentHash,
								now,
								extractVisibleText(params.snapshot.mdx),
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
					`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text)
					 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
					[
						id,
						JSON.stringify(metadata),
						data.mdx,
						data.schemaVersion,
						data.contentHash,
						now,
						extractVisibleText(data.mdx),
					],
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
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5, search_text = $6 WHERE entry_id = $7 AND state = 'working'`,
							[
								JSON.stringify(metadata),
								data.mdx,
								data.schemaVersion,
								data.contentHash,
								now,
								extractVisibleText(data.mdx),
								id,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text) VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
							[
								id,
								JSON.stringify(metadata),
								data.mdx,
								data.schemaVersion,
								data.contentHash,
								now,
								extractVisibleText(data.mdx),
							],
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
							`UPDATE "${qSchema}".entry_bodies SET metadata = $1, mdx = $2, schema_version = $3, content_hash = $4, updated_at = $5, search_text = $6 WHERE entry_id = $7 AND state = 'published'`,
							[
								JSON.stringify(working.metadata),
								working.mdx,
								working.schema_version,
								working.content_hash,
								working.updated_at,
								extractVisibleText(working.mdx),
								id,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text) VALUES ($1, 'published', $2, $3, $4, $5, $6, $7)`,
							[
								id,
								JSON.stringify(working.metadata),
								working.mdx,
								working.schema_version,
								working.content_hash,
								working.updated_at,
								extractVisibleText(working.mdx),
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

		createFolder: async (params: {
			collection: string;
			parentId: string | null;
			name: string;
			position?: number;
		}): Promise<Folder> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const id = randomUUID();
				if (params.parentId) {
					const pRes = await client.query<{ collection: string }>(
						`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
						[params.parentId],
					);
					if (pRes.rows.length === 0 || pRes.rows[0].collection !== params.collection) {
						throw new CmsError("Invalid parent", "invalid_input");
					}
				}
				const position = params.position ?? 0;
				const version = 1;
				await client.query(
					`INSERT INTO "${qSchema}".folders (id, collection, parent_id, name, position, version)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[id, params.collection, params.parentId, params.name, position, version],
				);
				await client.query("COMMIT");
				return { id, collection: params.collection, parentId: params.parentId, name: params.name, position, version };
			} catch (err) {
				await client.query("ROLLBACK");
				if (isFolderSiblingConflict(err)) {
					throw new CmsError("Conflict", "conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		updateFolder: async (params: {
			id: string;
			expectedVersion?: number;
			name?: string;
			parentId?: string | null;
			position?: number;
		}): Promise<Folder> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const currRes = await client.query<FolderRow>(
					`SELECT id, collection, parent_id, name, position, version FROM "${qSchema}".folders WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (currRes.rows.length === 0) {
					throw new CmsError("Not found", "not_found");
				}
				const curr = currRes.rows[0];

				if (params.expectedVersion !== undefined && curr.version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", curr.version);
				}

				const newName = params.name !== undefined ? params.name : curr.name;
				const newParentId = params.parentId !== undefined ? params.parentId : curr.parent_id;
				const newPosition = params.position !== undefined ? params.position : curr.position;
				const newVersion = curr.version + 1;

				if (newParentId) {
					const pRes = await client.query<{ collection: string }>(
						`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
						[newParentId],
					);
					if (pRes.rows.length === 0 || pRes.rows[0].collection !== curr.collection) {
						throw new CmsError("Invalid parent", "invalid_input");
					}
					let currentAncestor: string | null = newParentId;
					while (currentAncestor) {
						if (currentAncestor === params.id) {
							throw new CmsError("Cycle", "invalid_input");
						}
						const ancestorRes: QueryResult<{ parent_id: string | null }> = await client.query<{
							parent_id: string | null;
						}>(`SELECT parent_id FROM "${qSchema}".folders WHERE id = $1`, [currentAncestor]);
						if (ancestorRes.rows.length === 0) break;
						currentAncestor = ancestorRes.rows[0].parent_id;
					}
				}

				await client.query(`UPDATE "${qSchema}".folders SET name = $1, parent_id = $2, position = $3, version = $4 WHERE id = $5`, [
					newName,
					newParentId,
					newPosition,
					newVersion,
					params.id,
				]);
				await client.query("COMMIT");
				return {
					id: params.id,
					collection: curr.collection,
					parentId: newParentId,
					name: newName,
					position: newPosition,
					version: newVersion,
				};
			} catch (err) {
				await client.query("ROLLBACK");
				if (isFolderSiblingConflict(err)) {
					throw new CmsError("Conflict", "conflict");
				}
				if (typeof err === "object" && err !== null && (err as { code?: string }).code === "40P01") {
					throw new CmsError("Cycle", "invalid_input");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		deleteFolder: async (params: { id: string; expectedVersion?: number }): Promise<void> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const currRes = await client.query<{ parent_id: string | null; version: number }>(
					`SELECT parent_id, version FROM "${qSchema}".folders WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (currRes.rows.length === 0) {
					throw new CmsError("Not found", "not_found");
				}
				if (params.expectedVersion !== undefined && currRes.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", currRes.rows[0].version);
				}
				const parentId = currRes.rows[0].parent_id;

				await client.query(`UPDATE "${qSchema}".folders SET parent_id = $1 WHERE parent_id = $2`, [
					parentId,
					params.id,
				]);
				await client.query(`UPDATE "${qSchema}".entries SET folder_id = $1 WHERE folder_id = $2`, [
					parentId,
					params.id,
				]);
				await client.query(`DELETE FROM "${qSchema}".folders WHERE id = $1`, [params.id]);
				await client.query("COMMIT");
			} catch (err) {
				await client.query("ROLLBACK");
				if (isFolderSiblingConflict(err)) {
					throw new CmsError("Conflict", "conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		listFolders: async (params: { collection: string }): Promise<Folder[]> => {
			const res = await pool.query<FolderRow>(
				`
				SELECT id, collection, parent_id, name, position, version
				FROM "${qSchema}".folders
				WHERE collection = $1
				ORDER BY parent_id NULLS FIRST, position ASC, id ASC
			`,
				[params.collection],
			);
			return res.rows.map((row) => ({
				id: row.id,
				collection: row.collection,
				parentId: row.parent_id,
				name: row.name,
				position: row.position,
				version: row.version ?? 1,
			}));
		},

		moveEntryToFolder: async (params: {
			entryId: string;
			folderId: string | null;
			expectedVersion: number;
		}): Promise<Entry & { folderId: string | null }> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const eRes = await client.query<{ version: number; collection: string }>(
					`SELECT version, collection FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.entryId],
				);
				if (eRes.rows.length === 0) {
					throw new CmsError("Not found", "not_found");
				}
				if (eRes.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", eRes.rows[0].version);
				}
				if (params.folderId) {
					const fRes = await client.query<{ collection: string }>(
						`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
						[params.folderId],
					);
					if (fRes.rows.length === 0 || fRes.rows[0].collection !== eRes.rows[0].collection) {
						throw new CmsError("Invalid folder", "invalid_input");
					}
				}
				const newVersion = eRes.rows[0].version + 1;
				await client.query(`UPDATE "${qSchema}".entries SET folder_id = $1, version = $2 WHERE id = $3`, [
					params.folderId,
					newVersion,
					params.entryId,
				]);
				const entry = await loadEntry(client, params.entryId, qSchema);
				await client.query("COMMIT");
				return { ...entry, folderId: params.folderId };
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		listEntries: async (params: ListEntriesParams): Promise<ListEntriesResult> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			const collectionAllowlist = ["post", "memo", "category", "tag", "collection"];
			if (typeof params.collection !== "string" || !collectionAllowlist.includes(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			if (params.search !== undefined && typeof params.search !== "string") {
				throw new CmsError("Invalid search", "invalid_input");
			}
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}
			if (params.includeDescendants !== undefined && typeof params.includeDescendants !== "boolean") {
				throw new CmsError("Invalid includeDescendants", "invalid_input");
			}
			if (params.statuses !== undefined) {
				if (!Array.isArray(params.statuses)) {
					throw new CmsError("Invalid statuses", "invalid_input");
				}
				for (const s of params.statuses) {
					if (s !== "draft" && s !== "published") {
						throw new CmsError("Invalid status", "invalid_input");
					}
				}
			}
			if (params.folderId !== undefined && params.folderId !== null && typeof params.folderId !== "string") {
				throw new CmsError("Invalid folderId", "invalid_input");
			}
			if (params.sort !== undefined) {
				if (typeof params.sort !== "object" || params.sort === null || Array.isArray(params.sort)) {
					throw new CmsError("Invalid sort", "invalid_input");
				}
				const sortFields = ["updatedAt", "createdAt", "title", "slug"];
				if (typeof params.sort.field !== "string" || !sortFields.includes(params.sort.field)) {
					throw new CmsError("Invalid sort field", "invalid_input");
				}
				if (params.sort.direction !== "asc" && params.sort.direction !== "desc") {
					throw new CmsError("Invalid sort direction", "invalid_input");
				}
			}
			if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1)) {
				throw new CmsError("Invalid page", "invalid_input");
			}
			if (
				params.pageSize !== undefined &&
				params.pageSize !== 25 &&
				params.pageSize !== 50 &&
				params.pageSize !== 100
			) {
				throw new CmsError("Invalid pageSize", "invalid_input");
			}

			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const values: unknown[] = [];
			let valIdx = 1;

			conditions.push(`e.collection = $${valIdx++}`);
			values.push(params.collection);

			if (params.statuses && params.statuses.length > 0) {
				if (params.statuses.includes("draft") && !params.statuses.includes("published")) {
					conditions.push(
						`NOT EXISTS (SELECT 1 FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'published')`,
					);
				} else if (!params.statuses.includes("draft") && params.statuses.includes("published")) {
					conditions.push(
						`EXISTS (SELECT 1 FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'published')`,
					);
				}
			}

			if (params.folderId !== undefined) {
				if (params.folderId === null) {
					conditions.push(`e.folder_id IS NULL`);
				} else {
					if (params.includeDescendants) {
						const descRes = await pool.query<DescFolderRow>(
							`
							WITH RECURSIVE desc_folders AS (
								SELECT id FROM "${qSchema}".folders WHERE id = $1
								UNION ALL
								SELECT f.id FROM "${qSchema}".folders f
								INNER JOIN desc_folders df ON f.parent_id = df.id
							)
							SELECT id FROM desc_folders
						`,
							[params.folderId],
						);
						const ids = descRes.rows.map((r) => r.id);
						if (ids.length === 0) {
							conditions.push(`1 = 0`);
						} else {
							const idParams = ids.map(() => `$${valIdx++}`).join(", ");
							conditions.push(`e.folder_id IN (${idParams})`);
							values.push(...ids);
						}
					} else {
						conditions.push(`e.folder_id = $${valIdx++}`);
						values.push(params.folderId);
					}
				}
			}

			if (params.search) {
				const searchToken = `%${params.search.replace(/[%_\\]/g, "\\$&")}%`;
				let searchCond = `(
					e.working_slug ILIKE $${valIdx} OR
					(SELECT metadata->>'title' FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'working') ILIKE $${valIdx}`;
				if (params.includeBody) {
					searchCond += ` OR (SELECT search_text FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'working') ILIKE $${valIdx}`;
				}
				searchCond += `)`;
				conditions.push(searchCond);
				values.push(searchToken);
				valIdx++;
			}

			const whereClause = conditions.join(" AND ");

			let orderBy = "";
			const sortField = params.sort?.field ?? "updatedAt";
			const sortDir = params.sort?.direction === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST";

			if (sortField === "updatedAt") {
				orderBy = `e.updated_at ${sortDir}, e.id ASC`;
			} else if (sortField === "createdAt") {
				orderBy = `e.created_at ${sortDir}, e.id ASC`;
			} else if (sortField === "title") {
				orderBy = `(SELECT metadata->>'title' FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'working') ${sortDir}, e.id ASC`;
			} else if (sortField === "slug") {
				orderBy = `e.working_slug ${sortDir}, e.id ASC`;
			}

			const countRes = await pool.query<CountRow>(
				`SELECT COUNT(*) as count FROM "${qSchema}".entries e WHERE ${whereClause}`,
				values,
			);
			const total = countRes.rows.length > 0 ? parseInt(countRes.rows[0].count, 10) : 0;

			const dataQuery = `
				SELECT
					e.id, e.collection, e.folder_id, e.created_at, e.updated_at, e.published_at, e.working_slug,
					(SELECT metadata->>'title' FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'working') as title,
					EXISTS(SELECT 1 FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'published') as is_published,
					(SELECT metadata FROM "${qSchema}".entry_bodies b WHERE b.entry_id = e.id AND b.state = 'working') as working_metadata,
					(SELECT target_id FROM "${qSchema}".entry_references WHERE entry_id = e.id AND state = 'working' AND kind = 'category' LIMIT 1) as ref_category_id,
					(SELECT ARRAY_AGG(target_id::text) FROM "${qSchema}".entry_references WHERE entry_id = e.id AND state = 'working' AND kind = 'tag') as ref_tag_ids
				FROM "${qSchema}".entries e
				WHERE ${whereClause}
				ORDER BY ${orderBy}
				LIMIT ${pageSize} OFFSET ${offset}
			`;
			const dataRes = await pool.query<
				ListEntryRow & {
					working_metadata: Record<string, unknown> | null;
					ref_category_id: string | null;
					ref_tag_ids: string[] | null;
				}
			>(dataQuery, values);

			const items: ListEntriesItem[] = dataRes.rows.map((row) => {
				const meta = row.working_metadata || {};
				const categoryId = typeof meta.categoryId === "string" ? meta.categoryId : (row.ref_category_id ?? null);

				let tagIds: readonly string[];
				if (Array.isArray(meta.tagIds)) {
					tagIds = meta.tagIds.filter((t): t is string => typeof t === "string");
				} else {
					tagIds = row.ref_tag_ids || [];
				}

				let publishedAt: Date | null = null;
				if (typeof meta.publishedAt === "string" || typeof meta.publishedAt === "number") {
					const d = new Date(meta.publishedAt);
					if (!Number.isNaN(d.getTime())) {
						publishedAt = d;
					}
				} else if (meta.publishedAt instanceof Date) {
					publishedAt = meta.publishedAt;
				}
				if (!publishedAt) {
					publishedAt = row.published_at;
				}

				return {
					id: row.id,
					collection: row.collection,
					title: row.title ?? null,
					slug: row.working_slug,
					status: row.is_published ? "published" : "draft",
					folderId: row.folder_id,
					categoryId,
					tagIds,
					publishedAt,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
				};
			});

			return {
				items,
				total,
				page,
				pageSize,
			};
		},

		getIncomingReferences: async (params: { targetId: string }): Promise<IncomingReferenceItem[]> => {
			const res = await pool.query<{
				source_id: string;
				source_collection: string;
				source_title: string | null;
				source_slug: string | null;
				kind: ReferenceKind;
				is_stale: boolean;
				occurrences: readonly ReferenceOccurrence[];
			}>(
				`
				SELECT
					e.id as source_id,
					e.collection as source_collection,
					(b.metadata->>'title') as source_title,
					e.working_slug as source_slug,
					r.kind,
					r.is_stale,
					r.occurrences
				FROM "${qSchema}".entry_references r
				JOIN "${qSchema}".entries e ON e.id = r.entry_id
				LEFT JOIN "${qSchema}".entry_bodies b ON b.entry_id = e.id AND b.state = 'working'
				WHERE r.target_id = $1 AND r.state = 'working'
				ORDER BY e.updated_at DESC, e.id ASC
			`,
				[params.targetId],
			);

			return res.rows.map((row) => ({
				sourceId: row.source_id,
				sourceCollection: row.source_collection,
				sourceTitle: row.source_title,
				sourceSlug: row.source_slug,
				kind: row.kind,
				isStale: row.is_stale,
				occurrences: row.occurrences,
			}));
		},

		getPreferences: async (params: { userId: string }): Promise<JsonObject | null> => {
			const res = await pool.query<{ preferences: JsonObject }>(
				`SELECT preferences FROM "${qSchema}".user_preferences WHERE user_id = $1`,
				[params.userId],
			);
			if (res.rows.length === 0) {
				return null;
			}
			return res.rows[0].preferences;
		},

		savePreferences: async (params: { userId: string; preferences: JsonObject }): Promise<void> => {
			const now = new Date();
			const normalized = normalizeMetadata(params.preferences);
			await pool.query(
				`
				INSERT INTO "${qSchema}".user_preferences (user_id, preferences, updated_at)
				VALUES ($1, $2, $3)
				ON CONFLICT (user_id)
				DO UPDATE SET preferences = $2, updated_at = $3
			`,
				[params.userId, JSON.stringify(normalized), now],
			);
		},
	};
}
