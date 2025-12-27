import type { PostEntry } from "@/keystatic/types";
import { getContentMap } from "./store";

export const getSeriesList = async () => {
	const { postMap, seriesMap } = await getContentMap();

	const seriesPostsMap = new Map<string, PostEntry[]>();

	for (const post of postMap.values()) {
		if (!post.series) continue;

		const list = seriesPostsMap.get(post.series) ?? [];
		list.push(post);
		seriesPostsMap.set(post.series, list);
	}

	const list = Array.from(seriesMap.values()).map((series) => ({
		...series,
		posts: seriesPostsMap.get(series.slug) ?? [],
	}));

	return { list, total: list.length };
};
