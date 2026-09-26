import { PUBLIC_COLLECTIONS } from "./constants";
import type { StoreContext } from "./context";
import { CmsError } from "./errors";
import { mapPublishedEntryRow } from "./rows";
import type { EntryMetadata, PublishedEntryLookup, PublishedEntryRecord } from "./types";

function isPublicCollection(value: string): boolean {
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

/**
 * 공개 조회 전용(M7-BE-1). 공개 페이지·RSS·sitemap·OG가 요청마다 호출한다.
 * published 본문과 published 상태를 모두 요구하므로 초안·보관·휴지통은 어떤 경로로도 반환되지 않는다.
 */
export function createPublicReadOps(ctx: StoreContext) {
	const { pool, qSchema } = ctx;
	return {
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
	};
}
