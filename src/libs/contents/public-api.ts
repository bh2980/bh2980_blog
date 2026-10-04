import type { ReadEntry } from "@monti-cms/core/read";
import { categoryOf, excerptOf, isEvergreen, seoOfMemo, seoOfPost, tagsOf, titleOf } from "./read-model";
import type { Category, SeoMetadata, Tag } from "./types/contents";

/**
 * 공개 JSON API(`/api/cms/v1/public/*`)의 응답 모양. 주소·쪽 나누기·오류·캐시는 라이브러리 본체(서버 설정 `publicApi`)가
 * 맡고, 여기서는 글 하나를 이 블로그의 공개 DTO로 옮기는 `toPublicEntryDto`만 둔다(`cms.server.ts`가 `toJson`으로 쓴다).
 *
 * 관리자 전용 필드(version·folderId·상태 이력·내부 metadata)는 타입 수준에서 존재하지 않으므로 직렬화될 수 없다.
 */
export type PublicEntryDto = {
	collection: "post" | "memo";
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

/**
 * 읽기 API의 공개본을 공개 DTO로 옮긴다. 라이브러리가 공개본만 넘기므로 초안·보관·휴지통은 오지 않는다.
 * 게시글은 요약·카테고리·evergreen 여부를, 메모는 싣지 않는다. 카테고리를 풀 수 없는 게시글·발행일이 없는 글은
 * 공개 화면처럼 숨긴다(`null`).
 */
export function toPublicEntryDto(entry: ReadEntry, { body }: { readonly body: boolean }): PublicEntryDto | null {
	const isPost = entry.collection === "post";
	const seo = isPost ? seoOfPost(entry) : seoOfMemo(entry);
	const category = isPost ? categoryOf(entry) : null;
	if ((isPost && !category) || !entry.publishedAt) return null;

	return {
		collection: isPost ? "post" : "memo",
		slug: entry.slug,
		title: titleOf(entry),
		publishedAt: entry.publishedAt?.toISOString() ?? "",
		tags: tagsOf(entry),
		...(seo ? { seo } : {}),
		...(isPost ? { excerpt: excerptOf(entry) } : {}),
		...(category ? { category } : {}),
		...(isPost ? { isEvergreen: isEvergreen(entry) } : {}),
		...(body ? { body: entry.mdx } : {}),
	};
}
