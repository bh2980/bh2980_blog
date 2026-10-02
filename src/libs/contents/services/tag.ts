import "server-only";

import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";
import type { ListResult, Tag } from "../types/contents";

const contentRepository = getContentRepository();

export async function listTags(locale: Locale = DEFAULT_LOCALE): Promise<ListResult<Tag>> {
	const tagList = await contentRepository.listTags(locale);

	return {
		list: tagList,
		total: tagList.length,
	};
}
