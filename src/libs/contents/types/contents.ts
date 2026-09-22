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
 * - `ogImageId`: OG 이미지로 쓸 media id (렌더 해석은 v2)
 */
export type SeoMetadata = {
	title?: string;
	description?: string;
	canonicalUrl?: string;
	ogImageId?: string;
};

type BaseSeo = {
	/** SEO 메타. 입력한 값이 없으면 프로퍼티 자체가 없다. */
	seo?: SeoMetadata;
};

type BasePost = BaseSeo & {
	slug: string;
	title: string;
	contentMdx: string;
	excerpt: string;
	category: Category;
	tags: Tag[];
	isEvergreen?: boolean;
};

export type DraftPost = DraftState & BasePost;
export type PublishedPost = PublishedState & BasePost;
export type Post = DraftPost | PublishedPost;

type BaseMemo = BaseSeo & {
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
