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

	memoList.sort((a, b) => {
		const aTime = a.status === "published" ? new Date(a.publishedAt).getTime() : 0;
		const bTime = b.status === "published" ? new Date(b.publishedAt).getTime() : 0;

		return bTime - aTime;
	});

	return { list: memoList, total: memoList.length };
}

export async function listMemoSlugs() {
	return await contentRepository.listMemoSlugs();
}
