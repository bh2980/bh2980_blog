import type { MemoCategory, PostCategory } from "@/keystatic/collections";
import type { CollectionEntry, MemoEntry, PostEntry, TagEntry } from "@/keystatic/types";
import type { Expand } from "@/utils/types";

export type ListResult<T> = { list: T[]; total: number };

export type ListOptions = {
	category?: string;
};

export type Tag = TagEntry;
export type Memo = Expand<Omit<MemoEntry, "tags" | "category"> & { category: MemoCategory; tags: Tag[] }>;
export type Post = Expand<
	Omit<PostEntry, "tags" | "category"> & { category: PostCategory; tags: Tag[]; isStale?: boolean }
>;
export type Collection = Expand<CollectionEntry>;

export type MemoCategoryWithCount = MemoCategory & { count: number };
export type PostCategoryWithCount = PostCategory & { count: number };
