export type ListResult<T> = { list: T[]; total: number };

export type ListOptions = {
	category?: string;
};

/** NOTE
*View 타입은 본문, 디테일용
*Summary 타입은 리스트, 요약용
둘이 동일할 경우에도 일관적인 사용을 위해 구분, 추후 구분이 필요할 경우 수정
 */

export type MemoCategoryView = {
	slug: string;
	name: string;
	color: string;
};

export type MemoCategorySummary = {
	slug: string;
	name: string;
	color: string;
	count: number;
	order: number | null;
};

export type PostCategoryView = {
	slug: string;
	name: string;
	color: string;
};

export type PostCategorySummary = {
	slug: string;
	name: string;
	color: string;
	count: number;
	order: number | null;
};

export type TagView = {
	slug: string;
	name: string;
};

export type TagSummary = TagView;

export type MemoView = {
	slug: string;
	title: string;
	content: () => Promise<string>;
	publishedDate: string;
	category: MemoCategoryView;
	tags: TagSummary[];
};

export type MemoSummary = Pick<MemoView, "slug" | "title" | "publishedDate" | "category">;

export type PostView = {
	slug: string;
	title: string;
	content: () => Promise<string>;
	publishedDate: string;
	category: PostCategoryView;
	tags: TagSummary[];
};

export type PostSummary = Pick<PostView, "slug" | "title" | "publishedDate" | "category">;
