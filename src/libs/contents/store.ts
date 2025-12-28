import "server-only";

import { cache } from "react";
import { reader } from "@/keystatic/libs/reader";
import type { CollectionEntry, MemoEntry, PostEntry, TagEntry } from "@/keystatic/types";

const buildSlugMap = <T extends object>(items: Array<{ slug: string; entry: T }>) => {
	return new Map<string, T & { slug: string }>(items.map((item) => [item.slug, { ...item.entry, slug: item.slug }]));
};

const buildContentMap = async (): Promise<{
	postMap: Map<string, PostEntry>;
	memoMap: Map<string, MemoEntry>;
	tagMap: Map<string, TagEntry>;
	collectionMap: Map<string, CollectionEntry>;
}> => {
	const r = await reader();

	const [posts, memos, tags, collection] = await Promise.all([
		r.collections.post.all(),
		r.collections.memo.all(),
		r.collections.tag.all(),
		r.collections.collection.all(),
	]);

	const postMap = buildSlugMap(posts);
	const memoMap = buildSlugMap(memos);
	const tagMap = buildSlugMap(tags);
	const collectionMap = buildSlugMap(collection);

	return { postMap, memoMap, tagMap, collectionMap };
};

export const getContentMap = cache(() => buildContentMap());
