import type { Entry } from "@keystatic/core/reader";
import type keystaticConfig from "@/root/keystatic.config";

export type TagEntry = Entry<typeof keystaticConfig.collections.tag>;
export type MemoEntry = Entry<typeof keystaticConfig.collections.memo>;
export type PostEntry = Entry<typeof keystaticConfig.collections.post>;
export type CollectionEntry = Entry<typeof keystaticConfig.collections.collection>;
