import type { Entry } from "@keystatic/core/reader";
import type keystaticConfig from "@/root/keystatic.config";
import type { Expand } from "@/utils/types";

type withSlug<T extends object> = T & { slug: string };

export type MemoEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.memo>>>;
export type PostEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.post>>>;
export type MemoCategoryEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.memoCategory>>>;
export type PostCategoryEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.postCategory>>>;
export type TagEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.tag>>>;
export type ProjectEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.project>>>;
export type SeriesEntry = Expand<withSlug<Entry<typeof keystaticConfig.collections.series>>>;
