import "server-only";

import { KeystaticRepository } from "../repositories/keystatic";
import type { ListResult, Memo } from "../types/contents";

const contentRepository = new KeystaticRepository();

export async function getMemo(slug: string) {
	const memo = await contentRepository.getMemo(slug);

	return memo;
}

export async function getMemoList(): Promise<ListResult<Memo>> {
	const memoList = await contentRepository.listMemos();

	return { list: memoList, total: memoList.length };
}

export async function getMemoSlugList() {
	return await contentRepository.listMemoSlugs();
}
