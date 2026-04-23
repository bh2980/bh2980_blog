import "server-only";

import { compareDesc } from "date-fns";
import { verifyAccess } from "@/libs/admin/verify-access";
import { getContentRepository } from "../get-content-repository";
import type { ListResult, PublishedMemo } from "../types/contents";
import type { MemoListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getMemo(slug: string) {
	const memo = await contentRepository.getMemo(slug);

	if (memo?.status === "draft") return null;

	return memo;
}

export async function listMemos(query: MemoListQuery = {}): Promise<ListResult<PublishedMemo>> {
	const memoList = await contentRepository.listMemos({
		...query,
	});

	const publishedMemoList = memoList
		.filter((memo) => memo.status === "published")
		.sort((a, b) => compareDesc(a.publishedAt, b.publishedAt));

	return { list: publishedMemoList, total: publishedMemoList.length };
}

export async function listMemoSlugs() {
	return await contentRepository.listMemoSlugs();
}

export async function getPreviewMemo(slug: string) {
	const isAdmin = await verifyAccess();

	if (!isAdmin) return null;

	return await contentRepository.getMemo(slug);
}
