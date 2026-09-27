import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { isCollection } from "../../../core/collections";
import { mergeTranslationMetadata } from "../../../schema/derive";
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

type PublishedRow = {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	slug: string;
	metadata: EntryMetadata;
	source_metadata: EntryMetadata;
	mdx: string;
	published_at: Date | null;
	first_published_at: Date | null;
	body_updated_at: Date;
};

/**
 * 번역본은 원문 공개본과 함께 읽는다(v2 B4). 원문이 공개돼 있지 않으면 번역본도 공개 계층에 없다.
 * 원문은 `src`가 자기 자신이다.
 */
const sourceJoin = (qSchema: string) => `JOIN "${qSchema}".entries src
	   ON src.id = COALESCE(e.translation_group_id, e.id) AND src.status = 'published'
	 JOIN "${qSchema}".entry_bodies sb
	   ON sb.entry_id = src.id AND sb.state = 'published'`;

/** 표시 발행일은 공통 값이라 원문의 것을 쓴다. 수정일은 이 언어 본문의 것이다. */
const PUBLISHED_COLUMNS = (mdxExpr: string, address = "a") =>
	`e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
	 ${address}.slug AS slug, b.metadata, sb.metadata AS source_metadata, ${mdxExpr} AS mdx,
	 src.published_at, src.first_published_at, b.updated_at AS body_updated_at`;

/** 번역본 메타데이터 = 원문의 공통 값 + 번역본의 언어별 값. */
function mapPublishedRow(row: PublishedRow): PublishedEntryRecord {
	const isTranslation = row.translation_group_id !== row.id;
	const metadata =
		isTranslation && isCollection(row.collection)
			? (mergeTranslationMetadata(row.collection, row.source_metadata, row.metadata) as EntryMetadata)
			: row.metadata;
	return mapPublishedEntryRow({ ...row, metadata });
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
			/** 이 언어의 콘텐츠만. 없으면 모든 언어다(v2 B4). record 컬렉션은 기본 언어뿐이다. */
			locale?: string;
		}): Promise<PublishedEntryRecord[]> => {
			if (typeof params !== "object" || params === null || Array.isArray(params)) {
				throw new CmsError("Invalid parameters", "invalid_input");
			}
			assertPublicCollections(params.collections);
			if (params.includeBody !== undefined && typeof params.includeBody !== "boolean") {
				throw new CmsError("Invalid includeBody", "invalid_input");
			}
			if (params.locale !== undefined && typeof params.locale !== "string") {
				throw new CmsError("Invalid locale", "invalid_input");
			}

			const mdxExpr = params.includeBody === true ? "b.mdx" : "''::text";
			const res = await pool.query<PublishedRow>(
				`SELECT ${PUBLISHED_COLUMNS(mdxExpr)}
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses a
				   ON a.entry_id = e.id AND a.collection = e.collection AND a.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE e.status = 'published' AND e.collection = ANY($1::text[])
				   AND ($2::text IS NULL OR e.locale = $2)
				 ORDER BY b.updated_at DESC, e.id ASC`,
				[params.collections, params.locale ?? null],
			);

			return res.rows.map(mapPublishedRow);
		},

		// 요청 slug가 과거 주소(alias)면 정규 current slug를 가진 항목을 반환한다.
		// 같은 문자열이 alias와 current에 동시에 존재하면 current를 우선한다.
		// current 주소가 없는 항목은 반환하지 않는다(A3: 예약·삭제 주소는 공개 계층에 없다).
		getPublishedEntryBySlug: async (params: {
			collection: string;
			slug: string;
			includeBody?: boolean;
			/** 주소의 언어. 없으면 기본 언어다(v2 B4). */
			locale?: string;
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
			const res = await pool.query<PublishedRow & { is_alias: boolean }>(
				`SELECT ${PUBLISHED_COLUMNS(mdxExpr, "cur")}, (matched.type = 'alias') AS is_alias
				 FROM "${qSchema}".entries e
				 JOIN "${qSchema}".content_addresses matched
				   ON matched.entry_id = e.id AND matched.collection = e.collection AND matched.locale = $3
				  AND matched.slug = $2 AND matched.type IN ('current', 'alias')
				 JOIN "${qSchema}".content_addresses cur
				   ON cur.entry_id = e.id AND cur.collection = e.collection AND cur.type = 'current'
				 JOIN "${qSchema}".entry_bodies b
				   ON b.entry_id = e.id AND b.state = 'published'
				 ${sourceJoin(qSchema)}
				 WHERE e.status = 'published' AND e.collection = $1
				 ORDER BY (matched.type = 'current') DESC
				 LIMIT 1`,
				[params.collection, params.slug, params.locale ?? DEFAULT_LOCALE],
			);

			const row = res.rows[0];
			if (!row) return { status: "not_found" };

			return {
				status: row.is_alias ? "alias" : "current",
				entry: mapPublishedRow(row),
			};
		},
	};
}
