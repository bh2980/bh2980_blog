import "server-only";

import { getContentRepository } from "../get-content-repository";
import type { ListResult, Tag } from "../types/contents";

const contentRepository = getContentRepository();

export async function listTags(): Promise<ListResult<Tag>> {
	const tagList = await contentRepository.listTags();

	return {
		list: tagList,
		total: tagList.length,
	};
}
