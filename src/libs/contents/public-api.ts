import { z } from "zod";
import type { Category, Memo, Post, PublishedMemo, PublishedPost, SeoMetadata, Tag } from "./types/contents";

/**
 * M7-BE-3: 공개 HTTP 계약의 DTO와 질의 규칙.
 *
 * 여기서만 공개 응답 모양을 정한다. 관리자 전용 필드(version·folderId·상태 이력·내부 metadata)는
 * 타입 수준에서 존재하지 않으므로 직렬화될 수 없다. 업무 규칙은 다시 만들지 않고
 * `ContentRepository`(= 기존 공개 조회 계약)만 재사용한다.
 */
export const PUBLIC_API_COLLECTIONS = ["post", "memo"] as const;
export type PublicApiCollection = (typeof PUBLIC_API_COLLECTIONS)[number];

export const publicEntryCollectionSchema = z.enum(PUBLIC_API_COLLECTIONS);

/** §10.1: 목록은 기본 page=1, pageSize=25, 최대 100이다. */
export const publicEntriesQuerySchema = z.object({
	collection: publicEntryCollectionSchema.default("post"),
	category: z.string().min(1).optional(),
	tag: z.string().min(1).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PublicEntriesQuery = z.infer<typeof publicEntriesQuerySchema>;

export type PublicEntryDto = {
	collection: PublicApiCollection;
	slug: string;
	title: string;
	publishedAt: string;
	tags: Tag[];
	seo?: SeoMetadata;
	excerpt?: string;
	category?: Category;
	isEvergreen?: boolean;
	/** 상세 조회에만 실린다. 목록 응답에는 본문이 없다. */
	body?: string;
};

/** 공개 주소 판정. `isAlias`가 true면 요청 slug는 과거 주소이고 `slug`가 정규 주소다. */
export type PublicEntryAddress = {
	slug: string;
	isAlias: boolean;
};

export type PublicEntryPage = {
	items: PublicEntryDto[];
	total: number;
	page: number;
	pageSize: number;
};

function base(entry: PublishedPost | PublishedMemo) {
	return {
		slug: entry.slug,
		title: entry.title,
		publishedAt: entry.publishedAt,
		tags: entry.tags,
		...(entry.seo ? { seo: entry.seo } : {}),
	};
}

/**
 * 공개본만 직렬화한다.
 *
 * 저장소가 초안을 돌려주더라도(개발 모드 파일 저장소는 초안을 숨기지 않는다) 여기서 null이 되어
 * 목록에서는 빠지고 단건 조회는 404가 된다. 즉 공개 API 입구에서 한 번 더 fail-closed로 막는다.
 */
export function toPublicPost(post: Post, options: { includeBody: boolean }): PublicEntryDto | null {
	if (post.status !== "published") return null;

	return {
		collection: "post",
		...base(post),
		excerpt: post.excerpt,
		category: post.category,
		...(post.isEvergreen === undefined ? {} : { isEvergreen: post.isEvergreen }),
		...(options.includeBody ? { body: post.contentMdx } : {}),
	};
}

export function toPublicMemo(memo: Memo, options: { includeBody: boolean }): PublicEntryDto | null {
	if (memo.status !== "published") return null;

	return {
		collection: "memo",
		...base(memo),
		...(options.includeBody ? { body: memo.contentMdx } : {}),
	};
}

export function paginate<T>(
	items: readonly T[],
	page: number,
	pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number } {
	const start = (page - 1) * pageSize;

	return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

/** 요청 slug와 정규 slug 비교로 별칭을 판정한다(O1 A4/A8). 저장소 계약과 같은 규칙이다. */
export function toPublicAddress(requestedSlug: string, entrySlug: string): PublicEntryAddress {
	return { slug: entrySlug, isAlias: requestedSlug !== entrySlug };
}
