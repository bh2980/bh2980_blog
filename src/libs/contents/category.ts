import { getContentMap } from "./store";
import type { CategoryListMeta, CategoryWithCount, ListResult } from "./types";

export const getCategoryList = async (): Promise<ListResult<CategoryWithCount, CategoryListMeta>> => {
	const { postMap, categoryMap } = await getContentMap();

	const categoryCountMap = new Map(
		Array.from(categoryMap.values()).map((category) => [category.slug, { ...category, count: 0 }]),
	);

	let totalPostCount = 0;

	postMap.forEach((post) => {
		if (!post.category) {
			return;
		}

		const category = categoryCountMap.get(post.category);
		if (post.status === "draft" || !category) return;

		category.count++;
		totalPostCount++;
	});

	const list = Array.from(categoryCountMap.values());

	return { list, total: list.length, meta: { totalPostCount } };
};
