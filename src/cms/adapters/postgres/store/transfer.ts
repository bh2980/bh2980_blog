import { isDeepStrictEqual } from "node:util";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { type StoreContext, withTransaction } from "./context";
import { CmsError } from "./errors";
import {
	type FolderRow,
	insertReferences,
	MEDIA_COLUMNS,
	type MediaRow,
	mapFolderRow,
	mapMediaRow,
	mapTemplateRow,
	normalizeMetadata,
	TEMPLATE_COLUMNS,
	type TemplateRow,
	writeBody,
} from "./rows";
import type {
	EntryMetadata,
	ExportSnapshot,
	ExportSnapshotBody,
	ExportSnapshotEntry,
	ImportEntriesResult,
	ImportEntryItem,
	JsonObject,
} from "./types";

/** 이전 도구의 가져오기와 관리자 내보내기(§11.4). */
export function createTransferOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;
	return {
		/**
		 * 가져오기 전용 적재. 전체를 한 트랜잭션으로 처리한다.
		 * - 같은 ID가 이미 있고 내용이 완전히 같으면 skip, 다르면 conflict로 중단한다(조용한 덮어쓰기 금지).
		 * - slug가 다른 글에 이미 배정되어 있으면 conflict로 중단한다.
		 */
		importEntries: async (items: readonly ImportEntryItem[]): Promise<ImportEntriesResult> =>
			withTransaction(pool, async (client) => {
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
							`SELECT entry_id FROM "${qSchema}".content_addresses WHERE collection = $1 AND locale = $2 AND slug = $3`,
							[item.collection, item.locale ?? DEFAULT_LOCALE, item.slug],
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
				// 번역본은 원문을 가리키므로(FK) 원문을 먼저 넣는다(v2 B4).
				pending.sort((left, right) => Number(Boolean(left.translationOf)) - Number(Boolean(right.translationOf)));
				for (const item of pending) {
					await client.query(
						`INSERT INTO "${qSchema}".entries
						 (id, collection, status, version, created_at, updated_at, first_published_at, last_published_at, published_at, working_slug, folder_id, locale, translation_group_id)
						 VALUES ($1, $2, $3, 1, $4, $4, NULL, NULL, $5, $6, $7, $8, $9)`,
						[
							item.id,
							item.collection,
							item.status,
							now,
							item.publishedAt ?? null,
							item.slug,
							item.folderId ?? null,
							item.locale ?? DEFAULT_LOCALE,
							item.translationOf ?? null,
						],
					);

					await writeBody(client, qSchema, item.id, "working", {
						metadata: normalizeMetadata(item.working.metadata),
						mdx: item.working.mdx,
						schemaVersion: item.working.schemaVersion,
						contentHash: item.working.contentHash,
						updatedAt: now,
					});
					if (item.published) {
						await writeBody(client, qSchema, item.id, "published", {
							metadata: normalizeMetadata(item.published.metadata),
							mdx: item.published.mdx,
							schemaVersion: item.published.schemaVersion,
							contentHash: item.published.contentHash,
							updatedAt: now,
						});
					}

					if (item.slug !== null) {
						await client.query(
							`INSERT INTO "${qSchema}".content_addresses (collection, locale, slug, entry_id, type)
							 VALUES ($1, $2, $3, $4, $5)`,
							[
								item.collection,
								item.locale ?? DEFAULT_LOCALE,
								item.slug,
								item.id,
								item.published ? "current" : "reservation",
							],
						);
					}
				}

				// 참조는 모든 항목이 존재한 뒤에 넣어 FK 순서를 보장한다.
				for (const item of pending) {
					await insertReferences(client, qSchema, item.id, "working", item.references);
					if (item.published) await insertReferences(client, qSchema, item.id, "published", item.references);
				}

				return {
					imported: pending.length,
					skipped: outcomes.length - pending.length,
					items: outcomes,
				};
			}),

		/** 내보내기용 읽기 전용 스냅샷. 항목 순서를 고정해 같은 데이터면 같은 결과를 만든다. */
		readExportSnapshot: async (): Promise<ExportSnapshot> =>
			withTransaction(
				pool,
				async (client) => {
					const entriesRes = await client.query<{
						id: string;
						collection: string;
						locale: string;
						translation_group_id: string;
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
						`SELECT e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
					        e.status, e.version, e.folder_id, e.working_slug, e.created_at, e.updated_at,
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
						locale: string;
						slug: string;
						entry_id: string | null;
						type: string;
					}>(
						`SELECT collection, locale, slug, entry_id, type FROM "${qSchema}".content_addresses
						 ORDER BY collection ASC, locale ASC, slug ASC`,
					);

					const mediaRes = await client.query<MediaRow>(
						`SELECT ${MEDIA_COLUMNS} FROM "${qSchema}".media_assets ORDER BY id ASC`,
					);

					const templatesRes = await client.query<TemplateRow>(
						`SELECT ${TEMPLATE_COLUMNS}
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
							locale: row.locale,
							translationGroupId: row.translation_group_id,
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
						folders: foldersRes.rows.map(mapFolderRow),
						addresses: addressesRes.rows.map((row) => ({
							collection: row.collection,
							locale: row.locale,
							slug: row.slug,
							entryId: row.entry_id,
							type: row.type,
						})),
						media: mediaRes.rows.map(mapMediaRow),
						templates: templatesRes.rows.map(mapTemplateRow),
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
				},
				{ begin: "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY" },
			),
	};
}
