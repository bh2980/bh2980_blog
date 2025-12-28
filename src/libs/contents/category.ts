import "server-only";
import { getContentMap } from "./store";
import type { ListResult, MemoCategorySummary, MemoCategoryView, PostCategorySummary, PostCategoryView } from "./types";

export const getMemoCategory = async (slug: string): Promise<MemoCategoryView | null> => {
	const { memoCategoryMap } = await getContentMap();

	const category = memoCategoryMap.get(slug);

	if (!category) {
		return null;
	}

	return category;
};

export const getMemoCategoryList = async (): Promise<ListResult<MemoCategorySummary>> => {
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
	})).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	return { list: categoryList, total: memoMap.size };
};

export const getPostCategory = async (slug: string): Promise<PostCategoryView | null> => {
	const { postCategoryMap } = await getContentMap();

	const category = postCategoryMap.get(slug);

	if (!category) {
		return null;
	}

	return category;
};

export const getPostCategoryList = async (): Promise<ListResult<PostCategorySummary>> => {
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
	})).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	return { list: categoryList, total: postMap.size };
};
