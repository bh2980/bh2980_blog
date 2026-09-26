import { COLLECTIONS } from "../../../core/collections";
import { isUuid } from "../../../core/ids";
import type { StoreContext } from "./context";
import { CmsError } from "./errors";
import {
	type DateRange,
	type EntryStatus,
	LIST_SORT_FIELDS,
	type ListEntriesItem,
	type ListEntriesParams,
	type ListEntriesResult,
} from "./types";

const STATUSES: readonly EntryStatus[] = ["draft", "published", "archived", "trashed"];
const PAGE_SIZES = [25, 50, 100];

const escapeLike = (value: string) => `%${value.replace(/[%_\\]/g, "\\$&")}%`;

const isDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());

function assertParams(params: ListEntriesParams) {
	if (typeof params !== "object" || params === null || Array.isArray(params)) {
		throw new CmsError("Invalid parameters", "invalid_input");
	}
	if (!(COLLECTIONS as readonly string[]).includes(params.collection)) {
		throw new CmsError("Invalid collection", "invalid_input");
	}
	if (params.search !== undefined && typeof params.search !== "string")
		throw new CmsError("Invalid search", "invalid_input");
	for (const key of ["includeBody", "includeDescendants", "hasUnpublishedChanges", "scheduled"] as const) {
		if (params[key] !== undefined && typeof params[key] !== "boolean")
			throw new CmsError(`Invalid ${key}`, "invalid_input");
	}
	if (params.statuses !== undefined) {
		if (!Array.isArray(params.statuses) || params.statuses.some((s) => !STATUSES.includes(s))) {
			throw new CmsError("Invalid status", "invalid_input");
		}
	}
	for (const key of ["tagIds", "categoryIds"] as const) {
		const ids = params[key];
		if (ids !== undefined && (!Array.isArray(ids) || ids.some((id) => !isUuid(id)))) {
			throw new CmsError(`Invalid ${key}`, "invalid_input");
		}
	}
	if (params.folderId !== undefined && params.folderId !== null && !isUuid(params.folderId)) {
		throw new CmsError("Invalid folderId", "invalid_input");
	}
	for (const key of ["createdAt", "updatedAt", "publishedAt"] as const) {
		const range = params[key];
		if (range === undefined) continue;
		if ((range.from !== undefined && !isDate(range.from)) || (range.to !== undefined && !isDate(range.to))) {
			throw new CmsError(`Invalid ${key} range`, "invalid_input");
		}
	}
	if (params.sort !== undefined) {
		if (!LIST_SORT_FIELDS.includes(params.sort?.field) || !["asc", "desc"].includes(params.sort?.direction)) {
			throw new CmsError("Invalid sort", "invalid_input");
		}
	}
	if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1)) {
		throw new CmsError("Invalid page", "invalid_input");
	}
	if (params.pageSize !== undefined && !PAGE_SIZES.includes(params.pageSize)) {
		throw new CmsError("Invalid pageSize", "invalid_input");
	}
}

/** §3.2 관리자 목록. 검색·필터·정렬·페이지를 서버에서 처리한다. */
export function createListOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;

	return {
		listEntries: async (params: ListEntriesParams): Promise<ListEntriesResult> => {
			assertParams(params);
			const page = params.page ?? 1;
			const pageSize = params.pageSize ?? 25;

			const conditions: string[] = [];
			const values: unknown[] = [];
			const bind = (value: unknown) => {
				values.push(value);
				return `$${values.length}`;
			};

			conditions.push(`e.collection = ${bind(params.collection)}`);
			if (params.statuses && params.statuses.length > 0) {
				conditions.push(`e.status = ANY(${bind(params.statuses)}::text[])`);
			} else {
				// 기본 목록은 휴지통을 숨긴다(§5.3).
				conditions.push(`e.status <> 'trashed'`);
			}

			if (params.folderId === null) {
				conditions.push("e.folder_id IS NULL");
			} else if (params.folderId !== undefined) {
				conditions.push(
					params.includeDescendants
						? `e.folder_id IN (
							WITH RECURSIVE descendants AS (
								SELECT id FROM "${qSchema}".folders WHERE id = ${bind(params.folderId)}
								UNION ALL
								SELECT f.id FROM "${qSchema}".folders f JOIN descendants d ON f.parent_id = d.id
							)
							SELECT id FROM descendants
						)`
						: `e.folder_id = ${bind(params.folderId)}`,
				);
			}

			if (params.search) {
				const token = bind(escapeLike(params.search));
				conditions.push(
					`(e.working_slug ILIKE ${token} OR w.metadata->>'title' ILIKE ${token}${
						params.includeBody ? ` OR w.search_text ILIKE ${token}` : ""
					})`,
				);
			}
			if (params.tagIds && params.tagIds.length > 0) {
				conditions.push(`COALESCE(w.metadata->'tagIds', '[]'::jsonb) ?| ${bind(params.tagIds)}::text[]`);
			}
			if (params.categoryIds && params.categoryIds.length > 0) {
				conditions.push(`w.metadata->>'categoryId' = ANY(${bind(params.categoryIds)}::text[])`);
			}
			if (params.hasUnpublishedChanges !== undefined) {
				const changed =
					"(p.entry_id IS NOT NULL AND (p.content_hash <> w.content_hash OR e.working_slug IS DISTINCT FROM cur.slug))";
				conditions.push(params.hasUnpublishedChanges ? changed : `NOT ${changed}`);
			}
			if (params.scheduled !== undefined) {
				conditions.push(`sch.scheduled_at IS ${params.scheduled ? "NOT NULL" : "NULL"}`);
			}
			const addRange = (column: string, range: DateRange | undefined) => {
				if (range?.from) conditions.push(`${column} >= ${bind(range.from)}`);
				if (range?.to) conditions.push(`${column} <= ${bind(range.to)}`);
			};
			addRange("e.created_at", params.createdAt);
			addRange("e.updated_at", params.updatedAt);
			addRange("e.published_at", params.publishedAt);

			const sortColumns: Record<(typeof LIST_SORT_FIELDS)[number], string> = {
				updatedAt: "e.updated_at",
				createdAt: "e.created_at",
				publishedAt: "e.published_at",
				title: "w.metadata->>'title'",
				slug: "e.working_slug",
			};
			const sortColumn = sortColumns[params.sort?.field ?? "updatedAt"];
			const sortDir = params.sort?.direction === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST";

			const from = `
				FROM "${qSchema}".entries e
				JOIN "${qSchema}".entry_bodies w ON w.entry_id = e.id AND w.state = 'working'
				LEFT JOIN "${qSchema}".entry_bodies p ON p.entry_id = e.id AND p.state = 'published'
				LEFT JOIN "${qSchema}".content_addresses cur ON cur.entry_id = e.id AND cur.type = 'current'
				LEFT JOIN "${qSchema}".schedules sch ON sch.entry_id = e.id AND sch.status = 'pending'
				WHERE ${conditions.join(" AND ")}`;

			const countRes = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count ${from}`, values);
			const total = Number(countRes.rows[0]?.count ?? 0);

			const dataRes = await pool.query<{
				id: string;
				collection: string;
				status: EntryStatus;
				version: number;
				folder_id: string | null;
				created_at: Date;
				updated_at: Date;
				published_at: Date | null;
				trashed_at: Date | null;
				working_slug: string | null;
				metadata: Record<string, unknown>;
				has_changes: boolean;
				scheduled_at: Date | null;
			}>(
				`SELECT e.id, e.collection, e.status, e.version, e.folder_id, e.created_at, e.updated_at, e.published_at,
				        e.trashed_at, e.working_slug, w.metadata,
				        (p.entry_id IS NOT NULL AND (p.content_hash <> w.content_hash OR e.working_slug IS DISTINCT FROM cur.slug)) AS has_changes,
				        sch.scheduled_at
				 ${from}
				 ORDER BY ${sortColumn} ${sortDir}, e.id ASC
				 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
				values,
			);

			const baseItems = dataRes.rows.map((row) => {
				const meta = row.metadata ?? {};
				const tagIds = Array.isArray(meta.tagIds) ? meta.tagIds.filter((t): t is string => typeof t === "string") : [];
				const metaDate = typeof meta.publishedAt === "string" ? new Date(meta.publishedAt) : null;
				return {
					id: row.id,
					collection: row.collection,
					title: typeof meta.title === "string" ? meta.title : null,
					slug: row.working_slug,
					status: row.status,
					version: row.version,
					folderId: row.folder_id,
					categoryId: typeof meta.categoryId === "string" ? meta.categoryId : null,
					tagIds,
					hasUnpublishedChanges: row.has_changes,
					scheduledAt: row.scheduled_at,
					// 표시 발행일은 초안 메타데이터가 우선이다. 발행 때 같은 값이 `published_at`에 반영된다.
					publishedAt: metaDate && Number.isFinite(metaDate.getTime()) ? metaDate : row.published_at,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
					trashedAt: row.trashed_at,
				};
			});

			const relatedIds = [
				...new Set(baseItems.flatMap((item) => [...item.tagIds, ...(item.categoryId ? [item.categoryId] : [])])),
			];
			const titleById = new Map<string, string>();
			if (relatedIds.length > 0) {
				const res = await pool.query<{ id: string; title: string | null }>(
					`SELECT e.id::text AS id,
						COALESCE(NULLIF(w.metadata->>'title', ''), NULLIF(p.metadata->>'title', ''), e.working_slug) AS title
					 FROM "${qSchema}".entries e
					 LEFT JOIN "${qSchema}".entry_bodies w ON w.entry_id = e.id AND w.state = 'working'
					 LEFT JOIN "${qSchema}".entry_bodies p ON p.entry_id = e.id AND p.state = 'published'
					 WHERE e.collection IN ('tag', 'category') AND e.id::text = ANY($1::text[])`,
					[relatedIds],
				);
				for (const row of res.rows) if (row.title) titleById.set(row.id, row.title);
			}

			const items: ListEntriesItem[] = baseItems.map((item) => {
				const categoryTitle = item.categoryId ? titleById.get(item.categoryId) : undefined;
				return {
					...item,
					category: item.categoryId && categoryTitle ? { id: item.categoryId, title: categoryTitle } : null,
					tags: item.tagIds.flatMap((id) => {
						const title = titleById.get(id);
						return title ? [{ id, title }] : [];
					}),
				};
			});

			return { items, total, page, pageSize };
		},
	};
}
