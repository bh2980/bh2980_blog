import "server-only";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type { ListOptions, ListResult, MemoSummary } from "./types";

export const getMemo = async (slug: string) => {
	const { memoMap, memoCategoryMap, tagMap } = await getContentMap();

	const memo = memoMap.get(slug);
	if (!memo) {
		return null;
	}

	const category = memoCategoryMap.get(memo.category);

	if (!category) {
		return null;
	}

	const tags = memo.tags
		.filter(isDefined)
		.map((tag) => tagMap.get(tag))
		.filter(isDefined);

	const publishedDate = new Date(memo.publishedDate).toLocaleString("ko-KR", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return { ...memo, category, tags, publishedDate };
};

// NOTE: parameter destructuring 시 undefined를 방지하기 위해 기본값 {}를 지정
export const getMemoList = async ({ category, sort }: ListOptions = {}): Promise<ListResult<MemoSummary>> => {
	const { memoMap, memoCategoryMap } = await getContentMap();

	let memos = Array.from(memoMap.values());

	if (category) {
		memos = memos.filter((memo) => memo.category === category);
	}

	const list = memos
		.map((memo) => {
			const memoCategory = memoCategoryMap.get(memo.category);
			if (!memoCategory) return null;

			const publishedDate = new Date(memo.publishedDate).toLocaleDateString("ko-KR", {
				dateStyle: "short",
			});

			return {
				slug: memo.slug,
				title: memo.title,
				category: memoCategory,
				publishedDate,
			};
		})
		.filter(isDefined);

	return { list, total: list.length };
};
