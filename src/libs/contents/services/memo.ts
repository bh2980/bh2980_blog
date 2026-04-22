import "server-only";

import { getContentRepository } from "../get-content-repository";
import type { ListResult, Memo } from "../types/contents";
import type { MemoListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getMemo(slug: string) {
	const memo = await contentRepository.getMemo(slug);

	return memo;
}

export async function listMemos(query: MemoListQuery = {}): Promise<ListResult<Memo>> {
	const memoList = await contentRepository.listMemos({
		...query,
	});

	return { list: memoList, total: memoList.length };
}

export async function listMemoSlugs() {
	return await contentRepository.listMemoSlugs();
}
