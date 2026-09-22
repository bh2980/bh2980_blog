import "server-only";

import { compareDesc } from "date-fns";
import { canPreview } from "@/libs/admin/preview-access";
import { getContentRepository } from "../get-content-repository";
import { getDraftPreviewMemo } from "../repositories/draft-preview";
import type { ListResult, Memo, PublishedMemo } from "../types/contents";
import type { MemoListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getMemo(slug: string) {
	const memo = await contentRepository.getMemo(slug);

	if (memo?.status === "draft") return null;

	return memo;
}

export async function listMemos(query: MemoListQuery = {}): Promise<ListResult<PublishedMemo>> {
	const memoList = await contentRepository.listMemos({ ...query, status: "published" });

	const publishedMemoList = memoList
		.filter((memo) => memo.status === "published")
		.sort((a, b) => compareDesc(a.publishedAt, b.publishedAt));

	return { list: publishedMemoList, total: publishedMemoList.length };
}

export async function listMemoSlugs() {
	return await contentRepository.listMemoSlugs();
}

/**
 * 미리보기 조회. 권한 판정은 CMS 관리자 세션이다(M7-FE-1 / O1 A9).
 *
 * M9-FE-1: postgres 공개 저장소는 초안을 돌려주지 않으므로 관리자 전용 working 경로를
 * 한 번 더 본다. 공개 `getMemo`는 그대로 초안을 숨긴다.
 */
export async function getPreviewMemo(slug: string) {
	const isAdmin = await canPreview();

	if (!isAdmin) return null;

	const memo = await contentRepository.getMemo(slug);
	if (memo) return memo as Memo;

	return await getDraftPreviewMemo(slug);
}
