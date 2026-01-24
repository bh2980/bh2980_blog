import type { CategoryEntry, CollectionEntry, MemoEntry, PostEntry, TagEntry } from "@/keystatic/types";
import type { Expand } from "@/utils/types";

export type ListResult<T, M extends Record<string, unknown> | undefined = undefined> = {
	list: T[];
	total: number;
	meta?: M;
};

export type ListOptions = {
	category?: string;
};

export type WithSlug<T> = { slug: string } & T;

export type Tag = Expand<WithSlug<TagEntry>>;
export type Collection = Expand<WithSlug<CollectionEntry>>;
export type Category = WithSlug<CategoryEntry>;

export type Memo = Expand<Omit<WithSlug<MemoEntry>, "tags" | "category">> & {
	tags: Tag[];
	publishedAt: string;
};
export type Post = Expand<
	Omit<WithSlug<PostEntry>, "tags" | "category"> & {
		publishedAt: string;
		category: Category;
		tags: Tag[];
		isStale?: boolean;
		isDeprecated?: boolean;
		replacementPost?: string;
	}
>;

export type CategoryWithCount = Category & { count: number };
// TODO : total로 변경하거나 타입 정리
export type CategoryListMeta = { totalPostCount: number };
