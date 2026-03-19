import { shouldHideDraftContent } from "@/keystatic/libs/runtime";
import { getContentMap } from "./store";
import type { CategoryListMeta, CategoryWithCount, ContentAccessOptions, ListResult } from "./types";

export const getCategoryList = async (
	options: ContentAccessOptions = {},
): Promise<ListResult<CategoryWithCount, CategoryListMeta>> => {
	const { postMap, categoryMap } = await getContentMap(options);

	const categoryCountMap = new Map(
		Array.from(categoryMap.values()).map((category) => [category.slug, { ...category, count: 0 }]),
	);

	let totalPostCount = 0;

	postMap.forEach((post) => {
		if (!post.category) {
			return;
		}

		const category = categoryCountMap.get(post.category);
		if ((shouldHideDraftContent(options) && post.status === "draft") || !category) return;

		category.count++;
		totalPostCount++;
	});

	const list = Array.from(categoryCountMap.values());

	return { list, total: list.length, meta: { totalPostCount } };
};
