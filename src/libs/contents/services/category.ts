import "server-only";

import { KeystaticRepository } from "../repositories/keystatic";
import type { Category, ListResult } from "../types/contents";

const contentRepository = new KeystaticRepository();

export async function getCategoryList(): Promise<ListResult<Category>> {
	const categoryList = await contentRepository.listCategories();

	return {
		list: categoryList,
		total: categoryList.length,
	};
}
