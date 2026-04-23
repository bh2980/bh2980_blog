import "server-only";

import { getContentRepository } from "../get-content-repository";
import type { Category, ListResult } from "../types/contents";

const contentRepository = getContentRepository();

export async function listCategories(): Promise<ListResult<Category>> {
	const categoryList = await contentRepository.listCategories();

	return {
		list: categoryList,
		total: categoryList.length,
	};
}
