import type { Collection as keystaticCollection } from "@keystatic/core";
import type { Entry } from "@keystatic/core/reader";
import type keystaticConfig from "@/root/keystatic.config";
import type { Expand } from "@/utils/types";
import type { MemoCategory, PostCategory } from "./collections";

type EntryWithSlug<T extends keystaticCollection<any, any>> = Entry<T> & { slug: string };

export type TagEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.tag>>;
export type MemoEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.memo>>;
export type PostEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.post>>;
export type CollectionEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.collection>>;

export type Tag = TagEntry;
export type Memo = Expand<Omit<MemoEntry, "tags" | "category"> & { category: MemoCategory; tags: Tag[] }>;
export type Post = Expand<Omit<PostEntry, "tags" | "category"> & { category: PostCategory; tags: Tag[] }>;
export type Collection = Expand<Entry<typeof keystaticConfig.collections.collection>>;
