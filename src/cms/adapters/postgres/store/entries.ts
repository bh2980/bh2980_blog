import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { isRecordCollection } from "../../../core/collections";
import { computeContentHash } from "../../../core/snapshot";
import type { PreparedSnapshot, Reference, WorkingCopy } from "../../../core/types";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import {
	insertReferences,
	isReferencesEqual,
	loadEntry,
	lockEntryForUpdate,
	normalizeMetadata,
	readBody,
	readReferences,
	writeBody,
} from "./rows";
import type { Entry, IncomingReferenceItem } from "./types";

export function createEntryOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema } = ctx;
	const { publishWithinTransaction, lockDraftReferenceTargets } = publishing;

	const assertFolder = async (client: PoolClient, folderId: string | null | undefined, collection: string) => {
		if (!folderId) return;
		const res = await client.query<{ collection: string }>(
			`SELECT collection FROM "${qSchema}".folders WHERE id = $1`,
			[folderId],
		);
		if (res.rows[0]?.collection !== collection) throw new CmsError("Invalid folder", "invalid_input");
	};

	/**
	 * 초안의 slug를 예약한다(§6.2). 공개된 적 없는 이전 예약은 풀고, 자기 자신의 current·alias 주소로
	 * 되돌아가는 경우는 새로 예약하지 않는다(발행 때 current로 올린다). 다른 항목의 주소면 409다.
	 */
	const reserveSlug = async (client: PoolClient, entryId: string, collection: string, slug: string | null) => {
		await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [
			entryId,
		]);
		if (slug === null) return;
		const existing = await client.query<{ entry_id: string | null }>(
			`SELECT entry_id FROM "${qSchema}".content_addresses WHERE collection = $1 AND slug = $2`,
			[collection, slug],
		);
		if (existing.rows.length > 0) {
			if (existing.rows[0]?.entry_id === entryId) return;
			throw new CmsError("Slug conflict", "slug_conflict");
		}
		await client.query(
			`INSERT INTO "${qSchema}".content_addresses (collection, slug, entry_id, type) VALUES ($1, $2, $3, 'reservation')`,
			[collection, slug, entryId],
		);
	};

	return {
		createEntryWithReferences: async (params: {
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
			folderId?: string | null;
			publishImmediately?: boolean;
		}): Promise<Entry> =>
			withTransaction(
				pool,
				async (client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					await lockDraftReferenceTargets(client, params.references);
					await assertFolder(client, params.folderId, params.snapshot.collection);
					const id = randomUUID();
					const now = new Date();

					await client.query(
						`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id)
						 VALUES ($1, $2, 1, $3, $3, $4, $5)`,
						[id, params.snapshot.collection, now, params.snapshot.slug, params.folderId ?? null],
					);
					await writeBody(client, qSchema, id, "working", {
						metadata,
						mdx: params.snapshot.mdx,
						schemaVersion: params.snapshot.schemaVersion,
						contentHash: params.snapshot.contentHash,
						updatedAt: now,
					});
					await reserveSlug(client, id, params.snapshot.collection, params.snapshot.slug);
					await insertReferences(client, qSchema, id, "working", params.references);

					return params.publishImmediately
						? publishWithinTransaction(client, id, { expectedVersion: 1 })
						: loadEntry(client, id, qSchema);
				},
				{ mapError: mapEntryWriteError },
			),

		/**
		 * 최신 초안 저장(§5.1). 같은 값이면 버전·수정일을 바꾸지 않는다.
		 * 폴더만 옮기면 버전은 올리되 콘텐츠 수정일은 유지한다(§3.3).
		 * 예약된 항목은 폴더 이동만 허용한다(§5.4).
		 */
		saveWorkingWithReferences: async (params: {
			entryId: string;
			expectedVersion: number;
			snapshot: PreparedSnapshot;
			references: readonly Reference[];
			folderId?: string | null;
			publishImmediately?: boolean;
		}): Promise<Entry> =>
			withTransaction(
				pool,
				async (client) => {
					const metadata = normalizeMetadata(params.snapshot.metadata);
					const locked = await lockEntryForUpdate(client, qSchema, params.entryId);
					if (locked.collection !== params.snapshot.collection) {
						throw new CmsError("Collection mismatch", "invalid_input");
					}
					if (locked.version !== params.expectedVersion) {
						throw new CmsError("Conflict", "conflict", locked.version);
					}
					if (locked.status === "trashed") {
						throw new CmsError("A trashed entry must be restored before editing", "invalid_status");
					}

					const pending = await client.query(
						`SELECT 1 FROM "${qSchema}".schedules WHERE entry_id = $1 AND status = 'pending'`,
						[params.entryId],
					);
					const hasPendingSchedule = pending.rows.length > 0;
					if (hasPendingSchedule && params.publishImmediately) {
						throw new CmsError("Entry is scheduled and locked for editing", "locked");
					}

					await assertFolder(client, params.folderId, params.snapshot.collection);

					const body = await readBody(client, qSchema, params.entryId, "working");
					const currentRefs = await readReferences(client, qSchema, params.entryId, "working");
					const refsEqual = isReferencesEqual(currentRefs, params.references);
					const nextSlug = params.snapshot.slug;
					const bodyIdentical = Boolean(
						body &&
							body.content_hash === params.snapshot.contentHash &&
							body.mdx === params.snapshot.mdx &&
							body.schema_version === params.snapshot.schemaVersion &&
							locked.working_slug === nextSlug &&
							isDeepStrictEqual(body.metadata, metadata),
					);
					const folderChanged = params.folderId !== undefined;

					if (hasPendingSchedule && (!bodyIdentical || !refsEqual)) {
						throw new CmsError("Entry is scheduled and locked for editing", "locked");
					}
					await lockDraftReferenceTargets(client, params.references);

					let version = locked.version;
					if (!bodyIdentical || !refsEqual || folderChanged) {
						version += 1;
						const now = new Date();
						await client.query(
							`UPDATE "${qSchema}".entries SET version = $1, updated_at = $2, working_slug = $3,
							 folder_id = CASE WHEN $4::boolean THEN $5::uuid ELSE folder_id END
							 WHERE id = $6`,
							[
								version,
								bodyIdentical && refsEqual ? locked.updated_at : now,
								nextSlug,
								folderChanged,
								params.folderId ?? null,
								params.entryId,
							],
						);
						if (!bodyIdentical) {
							await writeBody(client, qSchema, params.entryId, "working", {
								metadata,
								mdx: params.snapshot.mdx,
								schemaVersion: params.snapshot.schemaVersion,
								contentHash: params.snapshot.contentHash,
								updatedAt: now,
							});
							if (locked.working_slug !== nextSlug) {
								await reserveSlug(client, params.entryId, locked.collection, nextSlug);
							}
						}
						if (!refsEqual) {
							await client.query(
								`DELETE FROM "${qSchema}".entry_references WHERE entry_id = $1 AND state = 'working'`,
								[params.entryId],
							);
							await insertReferences(client, qSchema, params.entryId, "working", params.references);
						}
					}

					return params.publishImmediately
						? publishWithinTransaction(client, params.entryId, { expectedVersion: version })
						: loadEntry(client, params.entryId, qSchema);
				},
				{ mapError: mapEntryWriteError },
			),

		getWorkingReferences: async (params: { entryId: string }): Promise<Reference[]> =>
			readReferences(pool, qSchema, params.entryId, "working"),

		hasPendingSchedule: async (params: { entryId: string }): Promise<boolean> => {
			const res = await pool.query(
				`SELECT 1 FROM "${qSchema}".schedules WHERE entry_id = $1 AND status = 'pending' LIMIT 1`,
				[params.entryId],
			);
			return res.rows.length > 0;
		},

		getWorking: async (params: { entryId: string }): Promise<WorkingCopy> => {
			const res = await pool.query<{
				collection: WorkingCopy["collection"];
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
			const row = res.rows[0];
			if (!row) throw new CmsError("Entry not found", "not_found");
			return {
				collection: row.collection,
				slug: row.working_slug,
				metadata: row.metadata,
				mdx: row.mdx,
				version: row.version,
				folderId: row.folder_id,
			};
		},

		getEntry: async (id: string): Promise<Entry> => loadEntry(pool, id, qSchema),

		/**
		 * 관리자 미리보기 전용 조회. working slug로 항목과 working 본문을 찾는다.
		 * 공개 조회와 달리 초안·보관·휴지통도 찾으므로 호출자가 관리자 인증을 먼저 통과해야 한다.
		 */
		getWorkingEntryBySlug: async (params: { collection: string; slug: string }): Promise<Entry | null> => {
			if (typeof params?.collection !== "string" || typeof params?.slug !== "string") {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			if (params.slug.trim().length === 0) throw new CmsError("Invalid slug", "invalid_input");
			const res = await pool.query<{ id: string }>(
				`SELECT id FROM "${qSchema}".entries WHERE collection = $1 AND working_slug = $2 LIMIT 1`,
				[params.collection, params.slug],
			);
			return res.rows[0] ? loadEntry(pool, res.rows[0].id, qSchema) : null;
		},

		publishEntry: async (params: { id: string; expectedVersion: number }): Promise<Entry> =>
			withTransaction(pool, (client) => publishWithinTransaction(client, params.id, params), {
				mapError: mapEntryWriteError,
			}),

		/**
		 * §6.3 복제: 최신 초안의 본문·필드·관계를 새 ID의 초안으로 복사한다.
		 * slug·발행 상태·예약·공개본·발행일·생성/수정 시각은 복사하지 않는다.
		 */
		duplicateEntry: async (params: { id: string }): Promise<Entry> =>
			withTransaction(pool, async (client) => {
				const res = await client.query<{
					collection: string;
					folder_id: string | null;
					metadata: Record<string, unknown>;
					mdx: string;
					schema_version: number;
				}>(
					`SELECT e.collection, e.folder_id, b.metadata, b.mdx, b.schema_version
					 FROM "${qSchema}".entries e
					 JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id AND b.state = 'working'
					 WHERE e.id = $1`,
					[params.id],
				);
				const orig = res.rows[0];
				if (!orig) throw new CmsError("Entry not found", "not_found");
				if (isRecordCollection(orig.collection)) {
					throw new CmsError("Record collections cannot be duplicated", "invalid_input");
				}

				const { publishedAt: _publishedAt, ...rest } = orig.metadata ?? {};
				const title = typeof rest.title === "string" && rest.title.trim() ? rest.title : "제목 없음";
				const metadata = normalizeMetadata({ ...rest, title: `${title} (복사)` });
				const newId = randomUUID();
				const now = new Date();

				await client.query(
					`INSERT INTO "${qSchema}".entries (id, collection, version, created_at, updated_at, working_slug, folder_id, status)
					 VALUES ($1, $2, 1, $3, $3, NULL, $4, 'draft')`,
					[newId, orig.collection, now, orig.folder_id],
				);
				await writeBody(client, qSchema, newId, "working", {
					metadata,
					mdx: orig.mdx,
					schemaVersion: orig.schema_version,
					contentHash: computeContentHash(metadata, orig.mdx, orig.schema_version),
					updatedAt: now,
				});
				await client.query(
					`INSERT INTO "${qSchema}".entry_references (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
					 SELECT $1, 'working', kind, target_id, target_entry_id, target_media_id, is_stale, occurrences
					 FROM "${qSchema}".entry_references
					 WHERE entry_id = $2 AND state = 'working'`,
					[newId, params.id],
				);
				return loadEntry(client, newId, qSchema);
			}),

		/** 상세 화면의 `사용처`. 필드 관계와 본문 참조를 초안/공개본으로 나눠 준다(§6.1). */
		getIncomingReferences: async (params: { targetId: string }): Promise<IncomingReferenceItem[]> => {
			const res = await pool.query<{
				state: "working" | "published";
				source_id: string;
				source_collection: string;
				source_title: string | null;
				source_slug: string | null;
				kind: IncomingReferenceItem["kind"];
				is_stale: boolean;
				occurrences: IncomingReferenceItem["occurrences"];
			}>(
				`SELECT
					r.state,
					e.id as source_id,
					e.collection as source_collection,
					(b.metadata->>'title') as source_title,
					CASE WHEN r.state = 'published' THEN current_address.slug ELSE e.working_slug END as source_slug,
					r.kind,
					r.is_stale,
					r.occurrences
				FROM "${qSchema}".entry_references r
				JOIN "${qSchema}".entries e ON e.id = r.entry_id
				LEFT JOIN "${qSchema}".entry_bodies b ON b.entry_id = e.id AND b.state = r.state
				LEFT JOIN "${qSchema}".content_addresses current_address
					ON current_address.entry_id = e.id AND current_address.collection = e.collection AND current_address.type = 'current'
				WHERE r.target_id = $1 AND r.state IN ('working', 'published')
					AND e.status <> 'trashed'
					AND (r.state <> 'published' OR e.status = 'published')
				ORDER BY CASE WHEN r.state = 'working' THEN 0 ELSE 1 END, e.updated_at DESC, e.id ASC`,
				[params.targetId],
			);
			return res.rows.map((row) => ({
				state: row.state,
				sourceId: row.source_id,
				sourceCollection: row.source_collection,
				sourceTitle: row.source_title,
				sourceSlug: row.source_slug,
				kind: row.kind,
				isStale: row.is_stale,
				occurrences: row.occurrences,
			}));
		},
	};
}
