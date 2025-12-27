import "server-only";

import { cache } from "react";
import { reader } from "@/keystatic/libs/reader";
import type { PostSummary } from "./types";

const buildSlugMap = <T extends object>(items: Array<{ slug: string; entry: T }>) => {
	return new Map<string, T & { slug: string }>(items.map((item) => [item.slug, { ...item.entry, slug: item.slug }]));
};

const buildContentMap = async () => {
	const r = await reader();

	const [posts, postCategories, memos, memoCategories, tags, projects, series] = await Promise.all([
		r.collections.post.all(),
		r.collections.postCategory.all(),
		r.collections.memo.all(),
		r.collections.memoCategory.all(),
		r.collections.tag.all(),
		r.collections.project.all(),
		r.collections.series.all(),
	]);

	const postMap = buildSlugMap(posts);
	const postCategoryMap = buildSlugMap(postCategories);
	const memoMap = buildSlugMap(memos);
	const memoCategoryMap = buildSlugMap(memoCategories);
	const tagMap = buildSlugMap(tags);
	const projectMap = buildSlugMap(projects);
	const seriesMap = new Map(
		series.map((series) => [series.slug, { ...series.entry, slug: series.slug, posts: [] as PostSummary[] }]),
	);

	return { postMap, postCategoryMap, memoMap, memoCategoryMap, tagMap, projectMap, seriesMap };
};

export const getContentMap = cache(() => buildContentMap());
