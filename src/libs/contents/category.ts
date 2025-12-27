import "server-only";
import { getContentMap } from "./store";

export const getMemoCategoryList = async () => {
	const { memoCategoryMap, memoMap } = await getContentMap();

	const count = Array.from(memoMap.values()).reduce((acc, memo) => {
		const { category } = memo;

		const prevCount = acc.get(category) ?? 0;
		acc.set(category, prevCount + 1);

		return acc;
	}, new Map<string, number>());

	const categoryList = Array.from(memoCategoryMap.values(), (category) => ({
		...category,
		count: count.get(category.slug) ?? 0,
	}));

	return { list: categoryList, total: memoMap.size };
};

export const getPostCategoryList = async () => {
	const { postCategoryMap, postMap } = await getContentMap();

	const count = Array.from(postMap.values()).reduce((acc, post) => {
		const { category } = post;

		const prevCount = acc.get(category) ?? 0;
		acc.set(category, prevCount + 1);

		return acc;
	}, new Map<string, number>());

	const categoryList = Array.from(postCategoryMap.values(), (category) => ({
		...category,
		count: count.get(category.slug) ?? 0,
	}));

	return { list: categoryList, total: postMap.size };
};
