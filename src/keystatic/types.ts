import type { ComponentSchema, Collection as keystaticCollection } from "@keystatic/core";
import type { Entry } from "@keystatic/core/reader";
import type keystaticConfig from "@/root/keystatic.config";
import type { Expand } from "@/utils/types";
import type { MemoCategory, PostCategory } from "./collections";

type EntryWithSlug<T extends keystaticCollection<Record<string, ComponentSchema>, string>> = Entry<T> & {
	slug: string;
};

export type TagEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.tag>>;
export type MemoEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.memo>>;
export type PostEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.post>>;
export type CollectionEntry = Expand<EntryWithSlug<typeof keystaticConfig.collections.collection>>;
