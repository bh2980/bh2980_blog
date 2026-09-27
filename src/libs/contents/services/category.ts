import "server-only";

import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";
import type { Category, ListResult } from "../types/contents";

const contentRepository = getContentRepository();

export async function listCategories(locale: Locale = DEFAULT_LOCALE): Promise<ListResult<Category>> {
	const categoryList = await contentRepository.listCategories(locale);

	return {
		list: categoryList,
		total: categoryList.length,
	};
}
