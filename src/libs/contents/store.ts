import "server-only";

import { reader } from "@/keystatic/libs/reader";
import type { CategoryEntry, CollectionEntry, MemoEntry, PostEntry, TagEntry } from "@/keystatic/types";
import { getSafeExcerpt } from "./post";
import type { ContentAccessOptions, WithSlug } from "./types";

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

const buildContentMap = async (
	options: ContentAccessOptions = {},
): Promise<{
	postMap: Map<string, WithSlug<PostEntry>>;
	memoMap: Map<string, WithSlug<MemoEntry>>;
	tagMap: Map<string, WithSlug<TagEntry>>;
	collectionMap: Map<string, WithSlug<CollectionEntry>>;
	categoryMap: Map<string, WithSlug<CategoryEntry>>;
}> => {
	const r = await reader(options);

	const [posts, memos, tags, collection, categories] = await Promise.all([
		r.collections.post.all(),
		r.collections.memo.all(),
		r.collections.tag.all(),
		r.collections.collection.all(),
		r.collections.category.all(),
	]);

	const postMap = await buildPostMap(posts);
	const memoMap = buildSlugMap(memos);
	const tagMap = buildSlugMap(tags);
	const collectionMap = buildSlugMap(collection);
	const categoryMap = buildSlugMap(categories);

	return { postMap, memoMap, tagMap, collectionMap, categoryMap };
};

type ContentMap = Awaited<ReturnType<typeof buildContentMap>>;

let publishedContentMapPromise: Promise<ContentMap> | null = null;

export const getContentMap = async (options: ContentAccessOptions = {}): Promise<ContentMap> => {
	if (options.preview) {
		return buildContentMap(options);
	}

	if (!publishedContentMapPromise) {
		publishedContentMapPromise = buildContentMap();
	}

	return publishedContentMapPromise;
};
