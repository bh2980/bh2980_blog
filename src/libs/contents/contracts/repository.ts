import type { Category, Memo, Post, Series, Tag } from "../types/contents";
import type { MemoListQuery, PostListQuery } from "../types/query";

/**
 * 공개 콘텐츠 조회 계약.
 *
 * 구현별 차이(Keystatic 파일 / CMS DB)를 흡수하기 위해 다음 규칙을 따른다.
 *
 * - 공개 조회는 공개본만 반환한다. CMS DB 구현은 초안·보관·휴지통을 절대 반환하지 않으므로
 *   `PostListQuery.status`의 `"all"`도 DB 구현에서는 `"published"`와 같은 결과다(초안 미노출이 우선).
 * - 과거 주소(alias)로 조회하면 정규 slug를 가진 항목을 반환한다.
 *   호출자는 `post.slug !== 요청 slug`를 308(영구 이동) 신호로 쓴다.
 * - DB 구현에서 목록 조회 결과의 `contentMdx`는 빈 문자열이다. 본문이 필요하면 단건 조회를 쓴다.
 */
export interface ContentRepository {
	getPost(slug: string): Promise<Post | null>;
	getMemo(slug: string): Promise<Memo | null>;
	getSeries(slug: string): Promise<Series | null>;
	listPosts(query: PostListQuery): Promise<Post[]>;
	listPostSlugs(): Promise<string[]>;
	listMemos(query: MemoListQuery): Promise<Memo[]>;
	listMemoSlugs(): Promise<string[]>;
	listCategories(): Promise<Category[]>;
	listTags(): Promise<Tag[]>;
	listSeries(): Promise<Series[]>;
}
