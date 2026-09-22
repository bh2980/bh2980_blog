import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool, PoolClient, QueryResult } from "pg";
import type {
	PreparedSnapshot,
	Reference,
	ReferenceKind,
	ReferenceOccurrence,
	WorkingCopy,
} from "../../services/types";

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

/** 공개 조회가 읽을 수 있는 컬렉션. 여기 없는 컬렉션은 공개 계층에 노출하지 않는다. */
export const PUBLIC_COLLECTIONS = ["post", "memo", "category", "tag", "collection"] as const;

/** 공개 조회 전용 항목. 초안·보관·휴지통은 이 타입으로 표현되지 않는다. */
export interface PublishedEntryRecord {
	readonly id: string;
	readonly collection: string;
	readonly slug: string;
	readonly metadata: EntryMetadata;
	/** `includeBody: false`인 목록 조회에서는 빈 문자열이다. */
	readonly mdx: string;
	readonly publishedAt: Date | null;
	readonly firstPublishedAt: Date | null;
	readonly updatedAt: Date;
}

/**
 * 공개 상세 조회 결과. `alias`는 과거 주소로 들어온 요청이며 `entry.slug`는 정규 current slug다.
 * 호출자는 `alias`를 308(영구 이동)으로 처리한다. `reservation`·`deleted` 주소와
 * current 주소가 없는 항목은 공개 계층에 존재하지 않으므로 `not_found`에 포함된다.
 */
export type PublishedEntryLookup =
	| { readonly status: "current"; readonly entry: PublishedEntryRecord }
	| { readonly status: "alias"; readonly entry: PublishedEntryRecord }
	| { readonly status: "not_found" };
function isPublicCollection(value: string): value is (typeof PUBLIC_COLLECTIONS)[number] {
	return (PUBLIC_COLLECTIONS as readonly string[]).includes(value);
}

function assertPublicCollections(collections: readonly string[]): void {
	if (!Array.isArray(collections) || collections.length === 0) {
		throw new CmsError("Invalid collections", "invalid_input");
	}
	for (const collection of collections) {
		if (typeof collection !== "string" || !isPublicCollection(collection)) {
			throw new CmsError("Invalid collection", "invalid_input");
		}
	}
}

function mapPublishedEntryRow(row: {
	id: string;
	collection: string;
	slug: string;
	metadata: EntryMetadata;
	mdx: string;
	published_at: Date | null;
	first_published_at: Date | null;
	body_updated_at: Date;
}): PublishedEntryRecord {
	return {
		id: row.id,
		collection: row.collection,
		slug: row.slug,
		metadata: row.metadata,
		mdx: row.mdx,
		publishedAt: row.published_at,
		firstPublishedAt: row.first_published_at,
		updatedAt: row.body_updated_at,
	};
}

export interface EntryBody {
	metadata: EntryMetadata;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
}

export interface BodyTemplate {
	id: string;
	name: string;
	forCollection: "post" | "memo";
	mdx: string;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Entry {
	id: string;
	collection: string;
	status: "draft" | "published" | "archived" | "trashed";
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
	publishedAt?: Date;
}

export interface MediaAssetRecord {
	id: string;
	status: "pending" | "ready" | "failed" | "deleting";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	stagingKey: string | null;
	storageKey: string | null;
	createdAt: Date;
	updatedAt: Date;
	readyAt: Date | null;
}

export interface CreateMediaAssetInput {
	id?: string;
	filename: string;
	mimeType: string;
	byteSize: number;
	stagingKey: string;
}

export interface CompleteMediaAssetInput {
	id: string;
	storageKey: string;
	mimeType: string;
	byteSize: number;
	width: number;
	height: number;
}

export interface MediaReferenceItem {
	entryId: string;
	title: string | null;
	collection: string;
	state: "working" | "published";
}

export interface ListMediaItem extends MediaAssetRecord {
	referencesCount: number;
	references: MediaReferenceItem[];
}

export interface ListMediaParams {
	search?: string;
	mimeType?: string;
	used?: "all" | "used" | "unused";
	page?: number;
	pageSize?: number;
}

export interface ListMediaResult {
	items: ListMediaItem[];
	total: number;
	page: number;
	pageSize: number;
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
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
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
	statuses?: readonly ("draft" | "published" | "archived" | "trashed")[];
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

export interface ExportSnapshotBody {
	metadata: EntryMetadata;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
}

export interface ExportSnapshotEntry {
	id: string;
	collection: string;
	status: string;
	version: number;
	folderId: string | null;
	workingSlug: string | null;
	publishedSlug: string | null;
	createdAt: Date;
	updatedAt: Date;
	firstPublishedAt: Date | null;
	lastPublishedAt: Date | null;
	publishedAt: Date | null;
	working: ExportSnapshotBody;
	published?: ExportSnapshotBody;
}

export interface ExportSnapshotReference {
	entryId: string;
	state: string;
	kind: string;
	targetId: string;
	isStale: boolean;
	occurrences: unknown;
}

export interface ExportSnapshotAddress {
	collection: string;
	slug: string;
	entryId: string | null;
	type: string;
}

export interface ExportSnapshotSchedule {
	id: string;
	entryId: string;
	scheduledAt: Date;
	status: string;
	createdAt: Date;
	completedAt: Date | null;
	failureCode: string | null;
	failureDetail: string | null;
}

/** 가져오기 전용 입력. 일반 createEntry와 달리 ID를 외부에서 지정한다. */
export interface ImportEntryBodyInput {
	metadata: unknown;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
}

export interface ImportEntryItem {
	id: string;
	collection: string;
	slug: string | null;
	status: "draft" | "published";
	folderId?: string | null;
	publishedAt?: Date | null;
	working: ImportEntryBodyInput;
	published?: ImportEntryBodyInput;
	references: readonly Reference[];
}

export interface ImportEntriesResult {
	imported: number;
	skipped: number;
	items: { id: string; collection: string; slug: string | null; outcome: "imported" | "skipped" }[];
}

/** 관리자 백업·공개 projection의 공통 원본. 단일 REPEATABLE READ READ ONLY 스냅샷이다. */
export interface ExportSnapshot {
	entries: ExportSnapshotEntry[];
	references: ExportSnapshotReference[];
	folders: Folder[];
	addresses: ExportSnapshotAddress[];
	media: MediaAssetRecord[];
	templates: BodyTemplate[];
	schedules: ExportSnapshotSchedule[];
	preferences: { userId: string; preferences: JsonObject; updatedAt: Date }[];
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
			entry_id UUID REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL,
			type TEXT NOT NULL CHECK (type IN ('reservation', 'current', 'alias', 'deleted')),
			PRIMARY KEY (collection, slug)
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".media_assets (
			id UUID PRIMARY KEY,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
			filename TEXT NOT NULL DEFAULT '',
			mime_type TEXT,
			byte_size BIGINT,
			width INTEGER,
			height INTEGER,
			staging_key TEXT,
			storage_key TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ready_at TIMESTAMPTZ
		);

		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting'));
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT '';
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS mime_type TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS byte_size BIGINT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS staging_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
		ALTER TABLE "${qSchema}".media_assets ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

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

		ALTER TABLE "${qSchema}".entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'trashed'));

		CREATE TABLE IF NOT EXISTS "${qSchema}".schedules (
			id UUID PRIMARY KEY,
			entry_id UUID NOT NULL REFERENCES "${qSchema}".entries(id) ON DELETE CASCADE,
			scheduled_at TIMESTAMPTZ NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
			created_at TIMESTAMPTZ NOT NULL,
			completed_at TIMESTAMPTZ,
			failure_code TEXT,
			failure_detail TEXT
		);

		CREATE INDEX IF NOT EXISTS schedules_due_idx ON "${qSchema}".schedules(scheduled_at) WHERE status = 'pending';
		CREATE UNIQUE INDEX IF NOT EXISTS schedules_active_entry_idx ON "${qSchema}".schedules(entry_id) WHERE status = 'pending';

		ALTER TABLE "${qSchema}".content_addresses ALTER COLUMN entry_id DROP NOT NULL;
		ALTER TABLE "${qSchema}".content_addresses DROP CONSTRAINT IF EXISTS content_addresses_entry_id_fkey;
		ALTER TABLE "${qSchema}".content_addresses ADD CONSTRAINT content_addresses_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES "${qSchema}".entries(id) ON DELETE SET NULL;

		ALTER TABLE "${qSchema}".entry_bodies ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';

		CREATE TABLE IF NOT EXISTS "${qSchema}".user_preferences (
			user_id TEXT PRIMARY KEY,
			preferences JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".cms_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS "${qSchema}".body_templates (
			id UUID PRIMARY KEY,
			name TEXT NOT NULL,
			for_collection TEXT NOT NULL CHECK (for_collection IN ('post', 'memo')),
			mdx TEXT NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL
		);

		CREATE UNIQUE INDEX IF NOT EXISTS body_templates_collection_name_idx
		ON "${qSchema}".body_templates (for_collection, lower(name));
	`);

	// One-time seed for initial default body templates (idempotent; won't resurrect deleted templates)
	const seedCheck = await pool.query(
		`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = 'seed_initial_body_templates'`,
	);
	if (seedCheck.rows.length === 0) {
		const initialTemplates = [
			{
				id: "00000000-0000-4000-8000-000000000001",
				name: "알고리즘 풀이",
				forCollection: "memo",
				mdx: "## 문제\n\n\n## 풀이\n\n```ts\n\n```\n",
			},
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Type Challenge 풀이",
				forCollection: "memo",
				mdx: "### 질문\n\n\n```ts\n\n```\n\n### 풀이\n\n",
			},
		];
		for (const t of initialTemplates) {
			await pool.query(
				`INSERT INTO "${qSchema}".body_templates (id, name, for_collection, mdx, version, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
				 ON CONFLICT DO NOTHING`,
				[t.id, t.name, t.forCollection, t.mdx],
			);
		}
		await pool.query(
			`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ('seed_initial_body_templates') ON CONFLICT DO NOTHING`,
		);
	}

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
	status: "draft" | "published" | "archived" | "trashed";
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
	version: number;
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
			e.id, e.collection, e.status, e.version, e.created_at, e.updated_at as entry_updated_at,
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
		status: first.status || "draft",
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

function isTemplateConflict(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === "23505" &&
		"constraint" in err &&
		(err.constraint === "body_templates_collection_name_idx" || err.constraint === "body_templates_pkey")
	);
}

/**
 * M7-TW-1: 같은 항목에 pending 예약은 하나만 존재한다(schedules_active_entry_idx).
 * DB가 막은 것을 그대로 올리면 500이 되므로 conflict로 매핑한다.
 */
function isScheduleConflict(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === "23505" &&
		"constraint" in err &&
		err.constraint === "schedules_active_entry_idx"
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

				// Check if entry has pending schedule (locks body editing, but allow folder-only move)
				const schedRes = await client.query<{ id: string }>(
					`SELECT id FROM "${qSchema}".schedules WHERE entry_id = $1 AND status = 'pending'`,
					[params.entryId],
				);
				const hasPendingSchedule = schedRes.rows.length > 0;

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

				if (hasPendingSchedule) {
					// Compare next working slug and metadata/mdx
					const slugChanged = currentWorkingSlug !== nextWorkingSlug;
					const bodyChanged = bodyRes.rows.length === 0 || !isBodyIdentical;
					if (slugChanged || bodyChanged || !refsEqual) {
						throw new CmsError("Entry is scheduled and locked for editing", "locked");
					}
				}

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

		hasPendingSchedule: async (params: { entryId: string }): Promise<boolean> => {
			const res = await pool.query(
				`SELECT 1 FROM "${qSchema}".schedules WHERE entry_id = $1 AND status = 'pending' LIMIT 1`,
				[params.entryId],
			);
			return res.rows.length > 0;
		},

		getWorking: async (params: { entryId: string }): Promise<WorkingCopy> => {
			const res = await pool.query<{
				collection: string;
				version: number;
				working_slug: string | null;
				folder_id: string | null;
				metadata: Record<string, unknown>;
				mdx: string;
			}>(
				`SELECT e.collection, e.version, e.working_slug, e.folder_id, b.metadata, b.mdx
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id AND b.state = 'working'
				 WHERE e.id = $1`,
				[params.entryId],
			);
			if (res.rows.length === 0) {
				throw new CmsError("Entry not found", "not_found");
			}
			const row = res.rows[0];
			return {
				collection: row.collection as WorkingCopy["collection"],
				slug: row.working_slug,
				metadata: row.metadata,
				mdx: row.mdx,
				version: row.version,
				folderId: row.folder_id,
			};
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
				if (isWorkingSlugConflict(err)) {
					throw new CmsError("Slug conflict", "slug_conflict");
				}
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

		publishEntry: async (
			idOrParams: string | { id: string; expectedVersion: number; publishedAt?: Date },
			dataParam?: PublishEntryInput,
		): Promise<Entry> => {
			const id = typeof idOrParams === "string" ? idOrParams : idOrParams.id;
			const data: PublishEntryInput = typeof idOrParams === "string" ? (dataParam as PublishEntryInput) : idOrParams;

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

				// --- Published References Target Recheck ---
				const workingRefsRes = await client.query<ReferenceRow>(
					`SELECT kind, target_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $1 AND state = 'working'
					 ORDER BY target_id ASC`,
					[id],
				);

				for (const ref of workingRefsRes.rows) {
					if (ref.kind === "media") {
						const mRes = await client.query<{ id: string }>(`SELECT id FROM "${qSchema}".media_assets WHERE id = $1`, [
							ref.target_id,
						]);
						if (mRes.rows.length === 0) {
							throw new CmsError("Unresolved media reference", "invalid_reference");
						}
					} else {
						const tRes = await client.query<{ id: string; status: string }>(
							`SELECT id, status FROM "${qSchema}".entries WHERE id = $1`,
							[ref.target_id],
						);
						if (tRes.rows.length === 0 || tRes.rows[0].status !== "published") {
							throw new CmsError("Unpublished or missing reference target", "invalid_reference");
						}
					}
				}

				const pubRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'published'`,
					[id],
				);

				const entryRes = await client.query<{
					first_published_at: Date | null;
					published_at: Date | null;
					collection: string;
					working_slug: string | null;
				}>(
					`SELECT first_published_at, published_at, collection, working_slug FROM "${qSchema}".entries WHERE id = $1`,
					[id],
				);
				const collection = entryRes.rows[0].collection;
				const firstPublishedAt = entryRes.rows[0].first_published_at;
				const currentPublishedAt = entryRes.rows[0].published_at;
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

				const newVersion = isRepublish ? currentVersion : currentVersion + 1;
				const now = new Date();
				const effectivePublishedAt = data.publishedAt ?? currentPublishedAt ?? now;

				if (!isRepublish) {
					await client.query(
						`UPDATE "${qSchema}".entries
						 SET version = $1, status = 'published', last_published_at = $2,
						     first_published_at = COALESCE(first_published_at, $3),
						     published_at = $4
						 WHERE id = $5`,
						[newVersion, now, now, effectivePublishedAt, id],
					);
				} else {
					await client.query(
						`UPDATE "${qSchema}".entries
						 SET status = 'published'
						 WHERE id = $1`,
						[id],
					);
				}

				if (!isRepublish) {
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

				// Atomically copy working references to published references
				await client.query(`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'published'`, [
					id,
				]);
				await client.query(
					`INSERT INTO "${qSchema}".entry_references
					 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
					 SELECT entry_id, 'published', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $1 AND state = 'working'`,
					[id],
				);

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

				await client.query(
					`UPDATE "${qSchema}".folders SET name = $1, parent_id = $2, position = $3, version = $4 WHERE id = $5`,
					[newName, newParentId, newPosition, newVersion, params.id],
				);
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

		duplicateEntry: async (params: { id: string }): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<{
					collection: string;
					folder_id: string | null;
					metadata: Record<string, unknown>;
					mdx: string;
					schema_version: number;
					content_hash: string;
				}>(
					`SELECT e.collection, e.folder_id, b.metadata, b.mdx, b.schema_version, b.content_hash
					 FROM "${qSchema}".entries e
					 JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id AND b.state = 'working'
					 WHERE e.id = $1`,
					[params.id],
				);
				if (res.rows.length === 0) {
					throw new CmsError("Entry not found", "not_found");
				}
				const orig = res.rows[0];

				const metadata = { ...(orig.metadata || {}) };
				if (typeof metadata.title === "string" && metadata.title.trim()) {
					metadata.title = `${metadata.title} (복사)`;
				} else {
					metadata.title = "제목 없음 (복사)";
				}

				const newId = randomUUID();
				const now = new Date();
				const version = 1;

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id, status)
					 VALUES ($1, $2, $3, $4, $5, NULL, $6, 'draft')`,
					[newId, orig.collection, version, now, now, orig.folder_id],
				);

				await client.query(
					`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text)
					 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
					[
						newId,
						JSON.stringify(normalizeMetadata(metadata)),
						orig.mdx,
						orig.schema_version,
						orig.content_hash,
						now,
						extractVisibleText(orig.mdx),
					],
				);

				await client.query(
					`INSERT INTO "${qSchema}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
					 SELECT $1, 'working', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $2 AND state = 'working'`,
					[newId, params.id],
				);

				const entry = await loadEntry(client, newId, qSchema);
				await client.query("COMMIT");
				return entry;
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
				conditions.push(`e.status = ANY($${valIdx++}::text[])`);
				values.push(params.statuses);
			} else {
				// Default list excludes trashed entries
				conditions.push(`e.status != 'trashed'`);
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
					e.id, e.collection, e.status, e.version, e.folder_id, e.created_at, e.updated_at, e.published_at, e.working_slug,
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
					status: (row as any).status || (row.is_published ? "published" : "draft"),
					version: row.version,
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

		// --- 공개 조회 전용 (M7-BE-1) ---
		// 공개 페이지·RSS·sitemap·OG가 요청마다 호출한다.
		// published 본문(state='published')과 published 상태(e.status='published')를 모두 요구하므로
		// 초안·보관·휴지통은 어떤 경로로도 반환되지 않는다.
		listPublishedEntries: async (params: {
			collections: readonly string[];
			includeBody?: boolean;
		}): Promise<PublishedEntryRecord[]> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			assertPublicCollections(params.collections);
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}

			const mdxExpr = params.includeBody === true ? "b.mdx" : "''::text";
			const res = await pool.query<{
				id: string;
				collection: string;
				slug: string;
				metadata: EntryMetadata;
				mdx: string;
				published_at: Date | null;
				first_published_at: Date | null;
				body_updated_at: Date;
			}>(
				`SELECT e.id, e.collection, a.slug, b.metadata, ${mdxExpr} AS mdx,
				        e.published_at, e.first_published_at, b.updated_at AS body_updated_at
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 WHERE e.status = 'published' AND e.collection = ANY($1::text[])
				 ORDER BY b.updated_at DESC, e.id ASC`,
				[params.collections],
			);

			return res.rows.map(mapPublishedEntryRow);
		},

		// 요청 slug가 과거 주소(alias)면 정규 current slug를 가진 항목을 반환한다.
		// 같은 문자열이 alias와 current에 동시에 존재하면 current를 우선한다.
		// current 주소가 없는 항목은 반환하지 않는다(A3: 예약·삭제 주소는 공개 계층에 없다).
		getPublishedEntryBySlug: async (params: {
			collection: string;
			slug: string;
			includeBody?: boolean;
		}): Promise<PublishedEntryLookup> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			if (typeof params.collection !== "string" || !isPublicCollection(params.collection)) {
				throw new CmsError("Invalid collection", "invalid_input");
			}
			if (typeof params.slug !== "string" || params.slug.length === 0) {
				throw new CmsError("Invalid slug", "invalid_input");
			}
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}

			const mdxExpr = params.includeBody !== false ? "b.mdx" : "''::text";
			const res = await pool.query<{
				id: string;
				collection: string;
				slug: string;
				metadata: EntryMetadata;
				mdx: string;
				published_at: Date | null;
				first_published_at: Date | null;
				body_updated_at: Date;
				is_alias: boolean;
			}>(
				`SELECT e.id, e.collection, cur.slug AS slug, b.metadata, ${mdxExpr} AS mdx,
				        e.published_at, e.first_published_at, b.updated_at AS body_updated_at,
				        (matched.type = 'alias') AS is_alias
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses matched
				   ON matched.entry_id = e.id AND matched.collection = e.collection
				  AND matched.slug = $2 AND matched.type IN ('current', 'alias')
				 JOIN "${qSchema}".content_addresses cur
				   ON cur.entry_id = e.id AND cur.collection = e.collection AND cur.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 WHERE e.status = 'published' AND e.collection = $1
				 ORDER BY (matched.type = 'current') DESC
				 LIMIT 1`,
				[params.collection, params.slug],
			);

			const row = res.rows[0];
			if (!row) return { status: "not_found" };

			return {
				status: row.is_alias ? "alias" : "current",
				entry: mapPublishedEntryRow(row),
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

		archiveEntry: async (params: { id: string; expectedVersion: number }): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}
				const newVersion = res.rows[0].version + 1;
				await client.query(`UPDATE "${qSchema}".entries SET status = 'archived', version = $1 WHERE id = $2`, [
					newVersion,
					params.id,
				]);
				// Cancel pending schedule
				await client.query(
					`UPDATE "${qSchema}".schedules SET status = 'cancelled' WHERE entry_id = $1 AND status = 'pending'`,
					[params.id],
				);
				const entry = await loadEntry(client, params.id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		unarchiveEntry: async (params: { id: string; expectedVersion: number }): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<{ version: number; status: string }>(
					`SELECT version, status FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}
				const newVersion = res.rows[0].version + 1;
				await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', version = $1 WHERE id = $2`, [
					newVersion,
					params.id,
				]);
				const entry = await loadEntry(client, params.id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		trashEntry: async (params: { id: string; expectedVersion: number }): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}
				const newVersion = res.rows[0].version + 1;
				await client.query(`UPDATE "${qSchema}".entries SET status = 'trashed', version = $1 WHERE id = $2`, [
					newVersion,
					params.id,
				]);
				// Cancel pending schedule
				await client.query(
					`UPDATE "${qSchema}".schedules SET status = 'cancelled' WHERE entry_id = $1 AND status = 'pending'`,
					[params.id],
				);
				const entry = await loadEntry(client, params.id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		restoreEntry: async (params: { id: string; expectedVersion: number }): Promise<Entry> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}
				const newVersion = res.rows[0].version + 1;
				await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', version = $1 WHERE id = $2`, [
					newVersion,
					params.id,
				]);
				const entry = await loadEntry(client, params.id, qSchema);
				await client.query("COMMIT");
				return entry;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		permanentDeleteEntry: async (params: { id: string; expectedVersion: number }): Promise<void> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}

				// Mark content_addresses as deleted tombstone (preserved!)
				await client.query(
					`UPDATE "${qSchema}".content_addresses SET type = 'deleted', entry_id = NULL WHERE entry_id = $1`,
					[params.id],
				);

				await client.query(`DELETE FROM "${qSchema}".entries WHERE id = $1`, [params.id]);
				await client.query("COMMIT");
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		getPublishedReferences: async (entryId: string): Promise<Reference[]> => {
			const res = await pool.query<ReferenceRow>(
				`SELECT kind, target_id, is_stale, occurrences
				 FROM "${qSchema}".entry_references
				 WHERE entry_id = $1 AND state = 'published'
				 ORDER BY kind ASC, target_id ASC`,
				[entryId],
			);
			return res.rows.map((row) => ({
				kind: row.kind,
				targetId: row.target_id,
				isStale: row.is_stale,
				occurrences: row.occurrences,
			}));
		},

		/**
		 * 가져오기 전용 적재. 전체를 한 트랜잭션으로 처리한다.
		 * - 같은 ID가 이미 있고 내용이 완전히 같으면 skip, 다르면 conflict로 중단한다(조용한 덮어쓰기 금지).
		 * - slug가 다른 글에 이미 배정되어 있으면 conflict로 중단한다.
		 * - 마이그레이션 실행 시각 같은 provenance는 저장하지 않는다(manifest/보고서에만 남긴다).
		 */
		importEntries: async (items: readonly ImportEntryItem[]): Promise<ImportEntriesResult> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const outcomes: ImportEntriesResult["items"] = [];
				const pending: ImportEntryItem[] = [];

				for (const item of items) {
					const existing = await client.query<{
						collection: string;
						status: string;
						working_slug: string | null;
						published_at: Date | null;
						folder_id: string | null;
						state: string;
						metadata: EntryMetadata;
						mdx: string;
						schema_version: number;
						content_hash: string;
					}>(
						`SELECT e.collection, e.status, e.working_slug, e.published_at, e.folder_id, b.state, b.metadata, b.mdx, b.schema_version, b.content_hash
						 FROM "${qSchema}".entries e
						 LEFT JOIN "${qSchema}".entry_bodies b ON b.entry_id = e.id
						 WHERE e.id = $1`,
						[item.id],
					);

					if (existing.rows.length > 0) {
						const head = existing.rows[0];
						const workingRow = existing.rows.find((row) => row.state === "working");
						const publishedRow = existing.rows.find((row) => row.state === "published");
						const sameWorking =
							workingRow !== undefined &&
							workingRow.content_hash === item.working.contentHash &&
							workingRow.schema_version === item.working.schemaVersion &&
							workingRow.mdx === item.working.mdx &&
							isDeepStrictEqual(workingRow.metadata, normalizeMetadata(item.working.metadata));
						const samePublished = item.published
							? publishedRow !== undefined &&
								publishedRow.content_hash === item.published.contentHash &&
								publishedRow.schema_version === item.published.schemaVersion &&
								publishedRow.mdx === item.published.mdx &&
								isDeepStrictEqual(publishedRow.metadata, normalizeMetadata(item.published.metadata))
							: publishedRow === undefined;
						const samePublishedAt =
							(item.publishedAt ?? null) === null
								? head.published_at === null
								: head.published_at instanceof Date && head.published_at.getTime() === item.publishedAt?.getTime();

						// 폴더·현재 주소·참조(occurrences 포함)까지 같아야 skip한다.
						const addresses = await client.query<{ slug: string; type: string }>(
							`SELECT slug, type FROM "${qSchema}".content_addresses WHERE entry_id = $1`,
							[item.id],
						);
						const expectedAddressType = item.published ? "current" : "reservation";
						const sameAddresses =
							item.slug === null
								? addresses.rows.length === 0
								: addresses.rows.length === 1 &&
									addresses.rows[0]?.slug === item.slug &&
									addresses.rows[0]?.type === expectedAddressType;

						const storedReferences = await client.query<{
							state: string;
							kind: string;
							target_id: string;
							is_stale: boolean;
							occurrences: unknown;
						}>(
							`SELECT state, kind, target_id, is_stale, occurrences FROM "${qSchema}".entry_references WHERE entry_id = $1`,
							[item.id],
						);
						const expectedReferenceStates = item.published ? ["working", "published"] : ["working"];
						const sortReferences = <T extends { state: string; kind: string; targetId: string }>(rows: T[]): T[] =>
							rows.sort((left, right) =>
								`${left.state}|${left.kind}|${left.targetId}` < `${right.state}|${right.kind}|${right.targetId}`
									? -1
									: 1,
							);
						const expectedReferences = sortReferences(
							expectedReferenceStates.flatMap((state) =>
								item.references.map((reference) => ({
									state,
									kind: reference.kind,
									targetId: reference.targetId,
									isStale: reference.isStale,
									occurrences: reference.occurrences,
								})),
							),
						);
						const actualReferences = sortReferences(
							storedReferences.rows.map((row) => ({
								state: row.state,
								kind: row.kind,
								targetId: row.target_id,
								isStale: row.is_stale,
								occurrences: row.occurrences,
							})),
						);
						const sameReferences = isDeepStrictEqual(actualReferences, expectedReferences);

						const identical =
							head.collection === item.collection &&
							head.status === item.status &&
							head.working_slug === item.slug &&
							head.folder_id === (item.folderId ?? null) &&
							sameWorking &&
							samePublished &&
							samePublishedAt &&
							sameAddresses &&
							sameReferences;

						if (identical) {
							outcomes.push({ id: item.id, collection: item.collection, slug: item.slug, outcome: "skipped" });
							continue;
						}
						throw new CmsError(
							`Import conflict: ${item.collection}/${item.slug ?? item.id} already exists with different content`,
							"conflict",
						);
					}

					if (item.slug !== null) {
						const address = await client.query<{ entry_id: string | null }>(
							`SELECT entry_id FROM "${qSchema}".content_addresses WHERE collection = $1 AND slug = $2`,
							[item.collection, item.slug],
						);
						if (address.rows.length > 0) {
							throw new CmsError(
								`Import conflict: ${item.collection}/${item.slug} is already taken by another entry`,
								"conflict",
							);
						}
					}

					pending.push(item);
					outcomes.push({ id: item.id, collection: item.collection, slug: item.slug, outcome: "imported" });
				}

				const now = new Date();
				for (const item of pending) {
					await client.query(
						`INSERT INTO "${qSchema}".entries
						 (id, collection, status, version, created_at, updated_at, first_published_at, last_published_at, published_at, working_slug, folder_id)
						 VALUES ($1, $2, $3, 1, $4, $4, NULL, NULL, $5, $6, $7)`,
						[item.id, item.collection, item.status, now, item.publishedAt ?? null, item.slug, item.folderId ?? null],
					);

					const workingMetadata = normalizeMetadata(item.working.metadata);
					await client.query(
						`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text)
						 VALUES ($1, 'working', $2, $3, $4, $5, $6, $7)`,
						[
							item.id,
							JSON.stringify(workingMetadata),
							item.working.mdx,
							item.working.schemaVersion,
							item.working.contentHash,
							now,
							extractVisibleText(item.working.mdx),
						],
					);

					if (item.published) {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text)
							 VALUES ($1, 'published', $2, $3, $4, $5, $6, $7)`,
							[
								item.id,
								JSON.stringify(normalizeMetadata(item.published.metadata)),
								item.published.mdx,
								item.published.schemaVersion,
								item.published.contentHash,
								now,
								extractVisibleText(item.published.mdx),
							],
						);
					}

					if (item.slug !== null) {
						await client.query(
							`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type)
							 VALUES ($1, $2, $3, $4)`,
							[item.collection, item.slug, item.id, item.published ? "current" : "reservation"],
						);
					}
				}

				// 참조는 모든 항목이 존재한 뒤에 넣어 FK 순서를 보장한다.
				for (const item of pending) {
					for (const ref of item.references) {
						const targetEntryId =
							ref.kind === "entry" || ref.kind === "category" || ref.kind === "tag" ? ref.targetId : null;
						const targetMediaId = ref.kind === "media" ? ref.targetId : null;
						for (const state of item.published ? (["working", "published"] as const) : (["working"] as const)) {
							await client.query(
								`INSERT INTO "${qSchema}".entry_references
								 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
								 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
								[
									item.id,
									state,
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
				}

				await client.query("COMMIT");

				return {
					imported: pending.length,
					skipped: outcomes.length - pending.length,
					items: outcomes,
				};
			} catch (err) {
				try {
					await client.query("ROLLBACK");
				} catch {
					// 이미 종료된 트랜잭션은 무시한다.
				}
				throw err;
			} finally {
				client.release();
			}
		},

		/** 내보내기용 읽기 전용 스냅샷. 항목 순서를 고정해 같은 데이터면 같은 결과를 만든다. */
		readExportSnapshot: async (): Promise<ExportSnapshot> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

				const entriesRes = await client.query<{
					id: string;
					collection: string;
					status: string;
					version: number;
					folder_id: string | null;
					working_slug: string | null;
					current_slug: string | null;
					created_at: Date;
					updated_at: Date;
					first_published_at: Date | null;
					last_published_at: Date | null;
					published_at: Date | null;
				}>(
					`SELECT e.id, e.collection, e.status, e.version, e.folder_id, e.working_slug, e.created_at, e.updated_at,
					        e.first_published_at, e.last_published_at, e.published_at,
					        (SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = e.id AND type = 'current') AS current_slug
					 FROM "${qSchema}".entries e
					 ORDER BY e.collection ASC, e.id ASC`,
				);

				const bodiesRes = await client.query<{
					entry_id: string;
					state: string;
					metadata: EntryMetadata;
					mdx: string;
					schema_version: number;
					content_hash: string;
					updated_at: Date;
				}>(
					`SELECT entry_id, state, metadata, mdx, schema_version, content_hash, updated_at
					 FROM "${qSchema}".entry_bodies ORDER BY entry_id ASC, state ASC`,
				);

				const referencesRes = await client.query<{
					entry_id: string;
					state: string;
					kind: string;
					target_id: string;
					is_stale: boolean;
					occurrences: unknown;
				}>(
					`SELECT entry_id, state, kind, target_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references ORDER BY entry_id ASC, state ASC, kind ASC, target_id ASC`,
				);

				const foldersRes = await client.query<FolderRow>(
					`SELECT id, collection, parent_id, name, position, version FROM "${qSchema}".folders ORDER BY collection ASC, id ASC`,
				);

				const addressesRes = await client.query<{
					collection: string;
					slug: string;
					entry_id: string | null;
					type: string;
				}>(
					`SELECT collection, slug, entry_id, type FROM "${qSchema}".content_addresses ORDER BY collection ASC, slug ASC`,
				);

				const mediaRes = await client.query<{
					id: string;
					status: string;
					filename: string;
					mime_type: string | null;
					byte_size: string | number | null;
					width: number | null;
					height: number | null;
					staging_key: string | null;
					storage_key: string | null;
					created_at: Date;
					updated_at: Date;
					ready_at: Date | null;
				}>(
					`SELECT id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key, created_at, updated_at, ready_at
					 FROM "${qSchema}".media_assets ORDER BY id ASC`,
				);

				const templatesRes = await client.query<{
					id: string;
					name: string;
					for_collection: string;
					mdx: string;
					version: number;
					created_at: Date;
					updated_at: Date;
				}>(
					`SELECT id, name, for_collection, mdx, version, created_at, updated_at
					 FROM "${qSchema}".body_templates ORDER BY for_collection ASC, lower(name) ASC, id ASC`,
				);

				const schedulesRes = await client.query<{
					id: string;
					entry_id: string;
					scheduled_at: Date;
					status: string;
					created_at: Date;
					completed_at: Date | null;
					failure_code: string | null;
					failure_detail: string | null;
				}>(
					`SELECT id, entry_id, scheduled_at, status, created_at, completed_at, failure_code, failure_detail
					 FROM "${qSchema}".schedules ORDER BY id ASC`,
				);

				const preferencesRes = await client.query<{ user_id: string; preferences: JsonObject; updated_at: Date }>(
					`SELECT user_id, preferences, updated_at FROM "${qSchema}".user_preferences ORDER BY user_id ASC`,
				);

				await client.query("COMMIT");

				const bodiesByEntry = new Map<string, ExportSnapshotBody>();
				const bodiesByEntryPublished = new Map<string, ExportSnapshotBody>();
				for (const row of bodiesRes.rows) {
					const body: ExportSnapshotBody = {
						metadata: row.metadata,
						mdx: row.mdx,
						schemaVersion: row.schema_version,
						contentHash: row.content_hash,
						updatedAt: row.updated_at,
					};
					if (row.state === "working") bodiesByEntry.set(row.entry_id, body);
					else if (row.state === "published") bodiesByEntryPublished.set(row.entry_id, body);
				}

				const entries: ExportSnapshotEntry[] = [];
				for (const row of entriesRes.rows) {
					const working = bodiesByEntry.get(row.id);
					if (!working) {
						throw new CmsError(`Entry ${row.id} is missing working body`, "invalid_state");
					}
					entries.push({
						id: row.id,
						collection: row.collection,
						status: row.status,
						version: row.version,
						folderId: row.folder_id,
						workingSlug: row.working_slug,
						publishedSlug: row.current_slug,
						createdAt: row.created_at,
						updatedAt: row.updated_at,
						firstPublishedAt: row.first_published_at,
						lastPublishedAt: row.last_published_at,
						publishedAt: row.published_at,
						working,
						...(bodiesByEntryPublished.has(row.id) ? { published: bodiesByEntryPublished.get(row.id) } : {}),
					});
				}

				return {
					entries,
					references: referencesRes.rows.map((row) => ({
						entryId: row.entry_id,
						state: row.state,
						kind: row.kind,
						targetId: row.target_id,
						isStale: row.is_stale,
						occurrences: row.occurrences,
					})),
					folders: foldersRes.rows.map((row) => ({
						id: row.id,
						collection: row.collection,
						parentId: row.parent_id,
						name: row.name,
						position: row.position,
						version: row.version ?? 1,
					})),
					addresses: addressesRes.rows.map((row) => ({
						collection: row.collection,
						slug: row.slug,
						entryId: row.entry_id,
						type: row.type,
					})),
					media: mediaRes.rows.map((row) => ({
						id: row.id,
						status: row.status as MediaAssetRecord["status"],
						filename: row.filename,
						mimeType: row.mime_type,
						byteSize: row.byte_size === null ? null : Number(row.byte_size),
						width: row.width,
						height: row.height,
						stagingKey: row.staging_key,
						storageKey: row.storage_key,
						createdAt: row.created_at,
						updatedAt: row.updated_at,
						readyAt: row.ready_at,
					})),
					templates: templatesRes.rows.map((row) => ({
						id: row.id,
						name: row.name,
						forCollection: row.for_collection as BodyTemplate["forCollection"],
						mdx: row.mdx,
						version: row.version,
						createdAt: row.created_at,
						updatedAt: row.updated_at,
					})),
					schedules: schedulesRes.rows.map((row) => ({
						id: row.id,
						entryId: row.entry_id,
						scheduledAt: row.scheduled_at,
						status: row.status,
						createdAt: row.created_at,
						completedAt: row.completed_at,
						failureCode: row.failure_code,
						failureDetail: row.failure_detail,
					})),
					preferences: preferencesRes.rows.map((row) => ({
						userId: row.user_id,
						preferences: row.preferences,
						updatedAt: row.updated_at,
					})),
				};
			} catch (err) {
				try {
					await client.query("ROLLBACK");
				} catch {
					// 이미 종료된 트랜잭션은 무시한다.
				}
				throw err;
			} finally {
				client.release();
			}
		},

		createSchedule: async (params: {
			entryId: string;
			expectedVersion: number;
			scheduledAt: Date;
		}): Promise<{ id: string; status: string; scheduledAt: Date }> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const res = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[params.entryId],
				);
				if (res.rows.length === 0) throw new CmsError("Not found", "not_found");
				if (res.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", res.rows[0].version);
				}

				const id = randomUUID();
				const now = new Date();
				await client.query(
					`INSERT INTO "${qSchema}".schedules (id, entry_id, scheduled_at, status, created_at)
					 VALUES ($1, $2, $3, 'pending', $4)`,
					[id, params.entryId, params.scheduledAt, now],
				);
				await client.query("COMMIT");
				return { id, status: "pending", scheduledAt: params.scheduledAt };
			} catch (err) {
				await client.query("ROLLBACK");
				if (isScheduleConflict(err)) {
					throw new CmsError("Entry already has a pending schedule", "conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		cancelSchedule: async (params: { scheduleId: string; entryId: string }): Promise<void> => {
			await pool.query(
				`UPDATE "${qSchema}".schedules SET status = 'cancelled' WHERE id = $1 AND entry_id = $2 AND status = 'pending'`,
				[params.scheduleId, params.entryId],
			);
		},

		getDueSchedules: async (): Promise<Array<{ id: string; entryId: string; scheduledAt: Date }>> => {
			const now = new Date();
			const res = await pool.query<{ id: string; entry_id: string; scheduled_at: Date }>(
				`SELECT id, entry_id, scheduled_at FROM "${qSchema}".schedules WHERE status = 'pending' AND scheduled_at <= $1 ORDER BY scheduled_at ASC`,
				[now],
			);
			return res.rows.map((r) => ({ id: r.id, entryId: r.entry_id, scheduledAt: r.scheduled_at }));
		},

		executeSchedulePublish: async (params: { scheduleId: string }): Promise<{ status: string }> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const sRes = await client.query<{ id: string; entry_id: string; status: string; scheduled_at: Date }>(
					`SELECT id, entry_id, status, scheduled_at FROM "${qSchema}".schedules WHERE id = $1 FOR UPDATE`,
					[params.scheduleId],
				);
				if (sRes.rows.length === 0) throw new CmsError("Schedule not found", "not_found");
				const sched = sRes.rows[0];

				if (sched.status === "completed") {
					await client.query("COMMIT");
					return { status: "completed" }; // Idempotent no-op
				}

				if (sched.status !== "pending") {
					throw new CmsError(`Schedule cannot be executed in status: ${sched.status}`, "conflict");
				}

				const eRes = await client.query<VersionRow>(
					`SELECT version FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
					[sched.entry_id],
				);
				if (eRes.rows.length === 0) throw new CmsError("Entry not found", "not_found");

				const bodyRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[sched.entry_id],
				);
				if (bodyRes.rows.length === 0) throw new CmsError("Working draft not found", "not_found");
				const working = bodyRes.rows[0];

				// --- Published References Target Recheck ---
				const workingRefsRes = await client.query<ReferenceRow>(
					`SELECT kind, target_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $1 AND state = 'working'
					 ORDER BY target_id ASC`,
					[sched.entry_id],
				);

				for (const ref of workingRefsRes.rows) {
					if (ref.kind === "media") {
						const mRes = await client.query<{ id: string }>(`SELECT id FROM "${qSchema}".media_assets WHERE id = $1`, [
							ref.target_id,
						]);
						if (mRes.rows.length === 0) {
							throw new CmsError("Unresolved media reference", "invalid_reference");
						}
					} else {
						const tRes = await client.query<{ id: string; status: string }>(
							`SELECT id, status FROM "${qSchema}".entries WHERE id = $1`,
							[ref.target_id],
						);
						if (tRes.rows.length === 0 || tRes.rows[0].status !== "published") {
							throw new CmsError("Unpublished or missing reference target", "invalid_reference");
						}
					}
				}

				const pubRes = await client.query<BodyRow>(
					`SELECT metadata, mdx, schema_version, content_hash, updated_at FROM "${qSchema}".entry_bodies WHERE entry_id = $1 AND state = 'published'`,
					[sched.entry_id],
				);

				const entryRes = await client.query<{
					first_published_at: Date | null;
					published_at: Date | null;
					collection: string;
					working_slug: string | null;
				}>(
					`SELECT first_published_at, published_at, collection, working_slug FROM "${qSchema}".entries WHERE id = $1`,
					[sched.entry_id],
				);
				const collection = entryRes.rows[0].collection;
				const currentPublishedAt = entryRes.rows[0].published_at;
				const targetSlug = entryRes.rows[0].working_slug;

				const currentSlugRes = await client.query<{ slug: string }>(
					`SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'current'`,
					[sched.entry_id],
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

				const currentVersion = eRes.rows[0].version;
				const newVersion = isRepublish ? currentVersion : currentVersion + 1;
				const now = new Date();
				const effectivePublishedAt = currentPublishedAt ?? sched.scheduled_at ?? now;

				if (!isRepublish) {
					await client.query(
						`UPDATE "${qSchema}".entries
						 SET version = $1, status = 'published', last_published_at = $2,
						     first_published_at = COALESCE(first_published_at, $3),
						     published_at = $4
						 WHERE id = $5`,
						[newVersion, now, now, effectivePublishedAt, sched.entry_id],
					);

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
								sched.entry_id,
							],
						);
					} else {
						await client.query(
							`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text) VALUES ($1, 'published', $2, $3, $4, $5, $6, $7)`,
							[
								sched.entry_id,
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
						[sched.entry_id],
					);

					if (currentSlug !== null && currentSlug !== targetSlug) {
						await client.query(
							`UPDATE "${qSchema}".content_addresses SET type = 'alias' WHERE entry_id = $1 AND type = 'current'`,
							[sched.entry_id],
						);
					}

					if (targetSlug !== null && targetSlug !== currentSlug) {
						await client.query(
							`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type) VALUES ($1, $2, $3, 'current')`,
							[collection, targetSlug, sched.entry_id],
						);
					}
				} else {
					await client.query(
						`UPDATE "${qSchema}".entries
						 SET status = 'published'
						 WHERE id = $1`,
						[sched.entry_id],
					);
				}

				// Copy references
				await client.query(`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'published'`, [
					sched.entry_id,
				]);
				await client.query(
					`INSERT INTO "${qSchema}".entry_references
					 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
					 SELECT entry_id, 'published', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $1 AND state = 'working'`,
					[sched.entry_id],
				);

				const publishedEntry = await loadEntry(client, sched.entry_id, qSchema);

				if (hooks.beforePublishCommit) {
					await hooks.beforePublishCommit(publishedEntry, client);
				}

				// Mark schedule completed
				await client.query(`UPDATE "${qSchema}".schedules SET status = 'completed', completed_at = $1 WHERE id = $2`, [
					now,
					params.scheduleId,
				]);

				await client.query("COMMIT");
				return { status: "completed" };
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		createMediaAsset: async (input: CreateMediaAssetInput): Promise<MediaAssetRecord> => {
			const id = input.id ?? randomUUID();
			const now = new Date();
			const res = await pool.query(
				`INSERT INTO "${qSchema}".media_assets (id, status, filename, mime_type, byte_size, staging_key, created_at, updated_at)
				 VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7)
				 RETURNING id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key, created_at, updated_at, ready_at`,
				[id, input.filename, input.mimeType, input.byteSize, input.stagingKey, now, now],
			);
			const row = res.rows[0];
			return {
				id: row.id,
				status: row.status,
				filename: row.filename,
				mimeType: row.mime_type,
				byteSize: row.byte_size ? Number(row.byte_size) : null,
				width: row.width,
				height: row.height,
				stagingKey: row.staging_key,
				storageKey: row.storage_key,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				readyAt: row.ready_at,
			};
		},

		getMediaAsset: async (id: string): Promise<MediaAssetRecord | null> => {
			const res = await pool.query(
				`SELECT id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key, created_at, updated_at, ready_at
				 FROM "${qSchema}".media_assets
				 WHERE id = $1`,
				[id],
			);
			if (res.rows.length === 0) return null;
			const row = res.rows[0];
			return {
				id: row.id,
				status: row.status,
				filename: row.filename,
				mimeType: row.mime_type,
				byteSize: row.byte_size ? Number(row.byte_size) : null,
				width: row.width,
				height: row.height,
				stagingKey: row.staging_key,
				storageKey: row.storage_key,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				readyAt: row.ready_at,
			};
		},

		completeMediaAsset: async (input: CompleteMediaAssetInput): Promise<MediaAssetRecord> => {
			const now = new Date();
			const res = await pool.query(
				`UPDATE "${qSchema}".media_assets
				 SET status = 'ready', storage_key = $1, mime_type = $2, byte_size = $3, width = $4, height = $5, updated_at = $6, ready_at = $7
				 WHERE id = $8
				 RETURNING id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key, created_at, updated_at, ready_at`,
				[input.storageKey, input.mimeType, input.byteSize, input.width, input.height, now, now, input.id],
			);
			if (res.rows.length === 0) {
				throw new CmsError("Media asset not found", "not_found");
			}
			const row = res.rows[0];
			return {
				id: row.id,
				status: row.status,
				filename: row.filename,
				mimeType: row.mime_type,
				byteSize: row.byte_size ? Number(row.byte_size) : null,
				width: row.width,
				height: row.height,
				stagingKey: row.staging_key,
				storageKey: row.storage_key,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				readyAt: row.ready_at,
			};
		},

		failMediaAsset: async (id: string): Promise<void> => {
			const now = new Date();
			await pool.query(
				`UPDATE "${qSchema}".media_assets
				 SET status = 'failed', updated_at = $1
				 WHERE id = $2`,
				[now, id],
			);
		},

		listMediaAssets: async (params: ListMediaParams = {}): Promise<ListMediaResult> => {
			const page = Math.max(1, params.page || 1);
			const pageSize = Math.max(1, Math.min(params.pageSize || 25, 100));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = ["m.status = 'ready'"];
			const values: any[] = [];

			if (params.search && params.search.trim()) {
				values.push(`%${params.search.trim()}%`);
				conditions.push(`m.filename ILIKE $${values.length}`);
			}

			if (params.mimeType && params.mimeType.trim()) {
				values.push(`${params.mimeType.trim()}%`);
				conditions.push(`m.mime_type LIKE $${values.length}`);
			}

			const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

			// Subquery/CTE to calculate used references
			const baseQuery = `
				FROM "${qSchema}".media_assets m
				LEFT JOIN "${qSchema}".entry_references r ON r.kind = 'media' AND r.target_media_id = m.id
				${whereClause}
				GROUP BY m.id
			`;

			let havingClause = "";
			if (params.used === "used") {
				havingClause = "HAVING COUNT(r.entry_id) > 0";
			} else if (params.used === "unused") {
				havingClause = "HAVING COUNT(r.entry_id) = 0";
			}

			// 1. Total count
			const countRes = await pool.query(
				`SELECT COUNT(*) FROM (
					SELECT m.id
					${baseQuery}
					${havingClause}
				) sub`,
				values,
			);
			const total = Number(countRes.rows[0].count);

			// 2. Fetch page items with aggregated references JSON
			const itemsQuery = `
				SELECT 
					m.id, m.status, m.filename, m.mime_type, m.byte_size, m.width, m.height,
					m.staging_key, m.storage_key, m.created_at, m.updated_at, m.ready_at,
					COUNT(r.entry_id) as ref_count,
					COALESCE(
						json_agg(
							json_build_object(
								'entryId', r.entry_id,
								'state', r.state,
								'collection', e.collection,
								'title', eb.metadata->>'title'
							)
						) FILTER (WHERE r.entry_id IS NOT NULL),
						'[]'
					) as references_json
				FROM "${qSchema}".media_assets m
				LEFT JOIN "${qSchema}".entry_references r ON r.kind = 'media' AND r.target_media_id = m.id
				LEFT JOIN "${qSchema}".entries e ON e.id = r.entry_id
				LEFT JOIN "${qSchema}".entry_bodies eb ON eb.entry_id = r.entry_id AND eb.state = r.state
				${whereClause}
				GROUP BY m.id
				${havingClause}
				ORDER BY m.created_at DESC, m.id DESC
				LIMIT $${values.length + 1} OFFSET $${values.length + 2}
			`;

			const res = await pool.query(itemsQuery, [...values, pageSize, offset]);

			const items: ListMediaItem[] = res.rows.map((row) => ({
				id: row.id,
				status: row.status,
				filename: row.filename,
				mimeType: row.mime_type,
				byteSize: row.byte_size ? Number(row.byte_size) : null,
				width: row.width,
				height: row.height,
				stagingKey: row.staging_key,
				storageKey: row.storage_key,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				readyAt: row.ready_at,
				referencesCount: Number(row.ref_count),
				references: row.references_json || [],
			}));

			return { items, total, page, pageSize };
		},

		deleteMediaAsset: async (id: string): Promise<void> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				// 1. Check if referenced in any working or published entries
				const refCheck = await client.query(
					`SELECT COUNT(*) as count FROM "${qSchema}".entry_references WHERE kind = 'media' AND target_media_id = $1`,
					[id],
				);
				const count = Number(refCheck.rows[0].count);
				if (count > 0) {
					throw new CmsError(`Media asset is in use by ${count} entries`, "in_use");
				}

				// 2. Delete media asset row
				const delRes = await client.query(`DELETE FROM "${qSchema}".media_assets WHERE id = $1 RETURNING id`, [id]);
				if (delRes.rows.length === 0) {
					throw new CmsError("Media asset not found", "not_found");
				}

				await client.query("COMMIT");
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},

		listTemplates: async (params?: { forCollection?: string }): Promise<BodyTemplate[]> => {
			const where = params?.forCollection ? `WHERE for_collection = $1` : ``;
			const values = params?.forCollection ? [params.forCollection] : [];
			const res = await pool.query<{
				id: string;
				name: string;
				for_collection: "post" | "memo";
				mdx: string;
				version: number;
				created_at: Date;
				updated_at: Date;
			}>(
				`SELECT id, name, for_collection, mdx, version, created_at, updated_at
				 FROM "${qSchema}".body_templates
				 ${where}
				 ORDER BY created_at ASC`,
				values,
			);
			return res.rows.map((row) => ({
				id: row.id,
				name: row.name,
				forCollection: row.for_collection,
				mdx: row.mdx,
				version: row.version,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		},

		getTemplate: async (id: string): Promise<BodyTemplate> => {
			const res = await pool.query<{
				id: string;
				name: string;
				for_collection: "post" | "memo";
				mdx: string;
				version: number;
				created_at: Date;
				updated_at: Date;
			}>(
				`SELECT id, name, for_collection, mdx, version, created_at, updated_at
				 FROM "${qSchema}".body_templates
				 WHERE id = $1`,
				[id],
			);
			if (res.rows.length === 0) {
				throw new CmsError("Template not found", "not_found");
			}
			const row = res.rows[0];
			return {
				id: row.id,
				name: row.name,
				forCollection: row.for_collection,
				mdx: row.mdx,
				version: row.version,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};
		},

		createTemplate: async (data: { name: string; forCollection: string; mdx: string }): Promise<BodyTemplate> => {
			if (data.forCollection !== "post" && data.forCollection !== "memo") {
				throw new CmsError("Invalid forCollection; must be 'post' or 'memo'", "invalid_input");
			}
			const name = (data.name || "").trim();
			if (!name) {
				throw new CmsError("Template name is required", "invalid_input");
			}
			const mdx = typeof data.mdx === "string" ? data.mdx : "";
			const id = randomUUID();
			const now = new Date();

			try {
				const res = await pool.query<{
					id: string;
					name: string;
					for_collection: "post" | "memo";
					mdx: string;
					version: number;
					created_at: Date;
					updated_at: Date;
				}>(
					`INSERT INTO "${qSchema}".body_templates (id, name, for_collection, mdx, version, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, 1, $5, $5)
					 RETURNING id, name, for_collection, mdx, version, created_at, updated_at`,
					[id, name, data.forCollection, mdx, now],
				);
				const row = res.rows[0];
				return {
					id: row.id,
					name: row.name,
					forCollection: row.for_collection,
					mdx: row.mdx,
					version: row.version,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
				};
			} catch (err) {
				if (isTemplateConflict(err)) {
					throw new CmsError("Template name already exists in collection", "conflict");
				}
				throw err;
			}
		},

		updateTemplate: async (params: {
			id: string;
			expectedVersion: number;
			name?: string;
			mdx?: string;
			forCollection?: string;
		}): Promise<BodyTemplate> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const curRes = await client.query<{
					name: string;
					for_collection: "post" | "memo";
					mdx: string;
					version: number;
				}>(
					`SELECT name, for_collection, mdx, version
					 FROM "${qSchema}".body_templates
					 WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (curRes.rows.length === 0) {
					throw new CmsError("Template not found", "not_found");
				}
				const cur = curRes.rows[0];
				if (cur.version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", cur.version);
				}

				let nextCollection = cur.for_collection;
				if (params.forCollection !== undefined) {
					if (params.forCollection !== "post" && params.forCollection !== "memo") {
						throw new CmsError("Invalid forCollection", "invalid_input");
					}
					nextCollection = params.forCollection as "post" | "memo";
				}

				let nextName = cur.name;
				if (params.name !== undefined) {
					nextName = params.name.trim();
					if (!nextName) throw new CmsError("Template name cannot be empty", "invalid_input");
				}

				const nextMdx = params.mdx !== undefined ? params.mdx : cur.mdx;
				const nextVersion = cur.version + 1;
				const now = new Date();

				const updRes = await client.query<{
					id: string;
					name: string;
					for_collection: "post" | "memo";
					mdx: string;
					version: number;
					created_at: Date;
					updated_at: Date;
				}>(
					`UPDATE "${qSchema}".body_templates
					 SET name = $1, for_collection = $2, mdx = $3, version = $4, updated_at = $5
					 WHERE id = $6
					 RETURNING id, name, for_collection, mdx, version, created_at, updated_at`,
					[nextName, nextCollection, nextMdx, nextVersion, now, params.id],
				);
				await client.query("COMMIT");
				const row = updRes.rows[0];
				return {
					id: row.id,
					name: row.name,
					forCollection: row.for_collection,
					mdx: row.mdx,
					version: row.version,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
				};
			} catch (err) {
				await client.query("ROLLBACK");
				if (isTemplateConflict(err)) {
					throw new CmsError("Template name already exists in collection", "conflict");
				}
				throw err;
			} finally {
				client.release();
			}
		},

		deleteTemplate: async (params: { id: string; expectedVersion?: number }): Promise<void> => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const curRes = await client.query<{ version: number }>(
					`SELECT version FROM "${qSchema}".body_templates WHERE id = $1 FOR UPDATE`,
					[params.id],
				);
				if (curRes.rows.length === 0) {
					throw new CmsError("Template not found", "not_found");
				}
				if (params.expectedVersion !== undefined && curRes.rows[0].version !== params.expectedVersion) {
					throw new CmsError("Conflict", "conflict", curRes.rows[0].version);
				}
				await client.query(`DELETE FROM "${qSchema}".body_templates WHERE id = $1`, [params.id]);
				await client.query("COMMIT");
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},
	};
}
