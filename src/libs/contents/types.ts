import type {
	CollectionEntry,
	MemoCategoryEntry,
	MemoEntry,
	PostCategoryEntry,
	PostEntry,
	TagEntry,
} from "@/keystatic/types";
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
export type MemoCategory = WithSlug<MemoCategoryEntry>;
export type PostCategory = WithSlug<PostCategoryEntry>;

export type Memo = Expand<Omit<WithSlug<MemoEntry>, "tags" | "category">> & {
	category: MemoCategory;
	tags: Tag[];
	publishedAt: string;
};
export type Post = Expand<
	Omit<WithSlug<PostEntry>, "tags" | "category"> & {
		publishedAt: string;
		category: PostCategory;
		tags: Tag[];
		isStale?: boolean;
		isDeprecated?: boolean;
		replacementPost?: string;
	}
>;

// TODO : 추후 동일
export type MemoCategoryWithCount = MemoCategory & { count: number };
export type MemoCategoryListMeta = { totalMemoCount: number };

export type PostCategoryWithCount = PostCategory & { count: number };
export type PostCategoryListMeta = { totalPostCount: number };
