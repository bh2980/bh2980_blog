import type { Locale } from "@/libs/i18n/locales";
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
	/** `locale`을 주지 않으면 기본 언어다(v2 B4). 번역본이 없는 언어는 결과에서 빠진다. */
	getPost(slug: string, locale?: Locale): Promise<Post | null>;
	getMemo(slug: string, locale?: Locale): Promise<Memo | null>;
	getSeries(slug: string, locale?: Locale): Promise<Series | null>;
	listPosts(query: PostListQuery, locale?: Locale): Promise<Post[]>;
	listPostSlugs(locale?: Locale): Promise<string[]>;
	listMemos(query: MemoListQuery, locale?: Locale): Promise<Memo[]>;
	listMemoSlugs(locale?: Locale): Promise<string[]>;
	/** 이름은 그 언어 값을 쓰고, 없으면 기본 언어 값이다. */
	listCategories(locale?: Locale): Promise<Category[]>;
	listTags(locale?: Locale): Promise<Tag[]>;
	listSeries(locale?: Locale): Promise<Series[]>;
	/** 같은 번역 묶음의 공개된 언어와 주소(`hreflang`, 언어 전환). */
	listTranslations(
		collection: "post" | "memo",
		translationGroupId: string,
	): Promise<{ locale: Locale; slug: string }[]>;
	/**
	 * 본문 내부 링크를 이 언어로 바꿀 때 쓰는 표. `post:기본 언어 slug` → 이 언어 번역본 slug.
	 * 기본 언어면 빈 표다.
	 */
	listLocalizedAddresses(locale: Locale): Promise<Map<string, string>>;
}
