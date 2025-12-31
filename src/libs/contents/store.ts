import "server-only";

import { cache } from "react";
import { reader } from "@/keystatic/libs/reader";
import type { CollectionEntry, MemoEntry, PostEntry, TagEntry } from "@/keystatic/types";
import { getSafeExcerpt } from "./remark";
import type { WithSlug } from "./types";

const buildSlugMap = <T>(items: Array<{ slug: string; entry: T }>): Map<string, WithSlug<T>> => {
	return new Map(items.map((item) => [item.slug, { ...item.entry, slug: item.slug }]));
};

const buildPostMap = async (posts: { slug: string; entry: PostEntry }[]): Promise<Map<string, WithSlug<PostEntry>>> => {
	const pairs = await Promise.all(
		posts.map(async ({ slug, entry }) => {
			const excerpt = entry.excerpt || getSafeExcerpt(await entry.content());

			return [slug, { ...entry, slug, excerpt }] as const;
		}),
	);

	return new Map(pairs);
};

const buildContentMap = async (): Promise<{
	postMap: Map<string, WithSlug<PostEntry>>;
	memoMap: Map<string, WithSlug<MemoEntry>>;
	tagMap: Map<string, WithSlug<TagEntry>>;
	collectionMap: Map<string, WithSlug<CollectionEntry>>;
}> => {
	const r = await reader();

	const [posts, memos, tags, collection] = await Promise.all([
		r.collections.post.all(),
		r.collections.memo.all(),
		r.collections.tag.all(),
		r.collections.collection.all(),
	]);

	const postMap = await buildPostMap(posts);
	const memoMap = buildSlugMap(memos);
	const tagMap = buildSlugMap(tags);
	const collectionMap = buildSlugMap(collection);

	return { postMap, memoMap, tagMap, collectionMap };
};

export const getContentMap = cache(() => buildContentMap());
