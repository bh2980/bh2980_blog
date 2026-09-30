import type { Locale } from "@/libs/i18n/locales";

export type ListResult<T> = {
	list: T[];
	total: number;
};

export type DraftState = {
	status: "draft";
};

export type PublishedState = {
	status: "published";
	publishedAt: string;
	/** 공개본이 마지막으로 바뀐 시각(ISO). 구조화 데이터·OG의 수정일이다. */
	updatedAt?: string;
};

export type Category = { slug: string; label: string };
export type Tag = { slug: string; label: string };

/**
 * 글별 SEO 메타(M7-FE-2). CMS 관리자에서 입력하며 모두 선택 항목이다.
 * 미입력 시 head는 title/summary로 폴백한다.
 *
 * - `title`: head·OG 제목. 미입력 시 글 title
 * - `description`: meta description·OG 설명. 미입력 시 글 summary
 * - `canonicalUrl`: 지정하면 canonical이 이 값이 되고 sitemap에서 제외된다
 * - `ogImageId`: 공유 이미지(OG·X 카드)로 쓸 media id. 없으면 제목으로 만든 카드
 * - `noindex`: 검색엔진에 숨긴다(robots noindex, sitemap 제외)
 */
export type SeoMetadata = {
	title?: string;
	description?: string;
	canonicalUrl?: string;
	ogImageId?: string;
	noindex?: true;
};

type BaseSeo = {
	/** SEO 메타. 입력한 값이 없으면 프로퍼티 자체가 없다. */
	seo?: SeoMetadata;
};

/** 콘텐츠 언어와 번역 묶음(v2 B4). 미리보기 초안은 없을 수 있다. */
type BaseLocale = {
	locale?: Locale;
	translationGroupId?: string;
};

type BasePost = BaseSeo &
	BaseLocale & {
		slug: string;
		title: string;
		contentMdx: string;
		excerpt: string;
		category: Category;
		tags: Tag[];
		isEvergreen?: boolean;
		/** `policy: deprecated`인 글. 공개된 대체 글이 있으면 안내한다(§6.4). */
		deprecation?: { replacement: { slug: string; title: string; locale?: Locale } | null };
	};

export type DraftPost = DraftState & BasePost;
export type PublishedPost = PublishedState & BasePost;
export type Post = DraftPost | PublishedPost;

type BaseMemo = BaseSeo &
	BaseLocale & {
		slug: string;
		title: string;
		contentMdx: string;
		tags: Tag[];
	};

export type DraftMemo = DraftState & BaseMemo;
export type PublishedMemo = PublishedState & BaseMemo;
export type Memo = DraftMemo | PublishedMemo;

export type Series = {
	slug: string;
	label: string;
	description?: string;
	items: Post[];
};
