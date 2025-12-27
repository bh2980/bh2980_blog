import { getPostCategory } from "./category";
import { getContentMap } from "./store";
import type { ListResult, PostCategoryView, PostSummary, SeriesSummary } from "./types";

export const getSeriesList = async (): Promise<ListResult<SeriesSummary>> => {
	const { postMap, seriesMap } = await getContentMap();

	const seriesPostsMap = new Map<string, PostSummary[]>();

	for (const post of postMap.values()) {
		if (!post.series) continue;

		const list = seriesPostsMap.get(post.series) ?? [];
		const category = await getPostCategory(post.category);
		if (!category) continue;

		list.push({
			slug: post.slug,
			title: post.title,
			publishedDate: post.publishedDate,
			category: { slug: category.slug, name: category.name, color: category.color } satisfies PostCategoryView,
		});
		seriesPostsMap.set(post.series, list);
	}

	const list = Array.from(seriesMap.values()).map((series) => ({
		...series,
		posts: seriesPostsMap.get(series.slug) ?? [],
	}));

	return { list, total: list.length };
};
