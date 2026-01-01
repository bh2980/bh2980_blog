import "server-only";
import { MEMO_CATEGORY_LIST } from "@/keystatic/collections";
import type { MemoEntry } from "@/keystatic/types";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type {
	ListOptions,
	ListResult,
	Memo,
	MemoCategoryListMeta,
	MemoCategoryWithCount,
	Tag,
	WithSlug,
} from "./types";

const normalizeMemo = (
	memo: WithSlug<MemoEntry>,
	tagMap: Map<string, Tag>,
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Memo | null => {
	const category = MEMO_CATEGORY_LIST.find((category) => category.value === memo.category);

	if (!category) {
		return null;
	}

	const tags = memo.tags
		.filter(isDefined)
		.map((tag) => tagMap.get(tag))
		.filter(isDefined);

	const publishedDate = new Date(memo.publishedDate).toLocaleString("ko-KR", dateTimeOptions);

	return { ...memo, category, tags, publishedDate };
};

export const getMemo = async (slug: string): Promise<Memo | null> => {
	const { memoMap, tagMap } = await getContentMap();

	const memo = memoMap.get(slug);
	if (!memo) {
		return null;
	}

	return normalizeMemo(memo, tagMap, {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

export const getMemoList = async ({
	category: categoryFilter,
}: ListOptions = {}): Promise<ListResult<Omit<Memo, "content">>> => {
	const { memoMap, tagMap } = await getContentMap();

	let memos = Array.from(memoMap.values()).toSorted(
		(a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime(),
	);

	if (categoryFilter) {
		memos = memos.filter((memo) => memo.category === categoryFilter);
	}

	const list = memos
		.map((memo) => normalizeMemo(memo, tagMap, { dateStyle: "short" }))
		.filter(isDefined)
		.map(({ content, ...rest }) => rest);

	return { list, total: list.length };
};

export const getMemoCategoryList = async (): Promise<ListResult<MemoCategoryWithCount, MemoCategoryListMeta>> => {
	const { memoMap } = await getContentMap();

	const memoCategoryMap = new Map(MEMO_CATEGORY_LIST.map((category) => [category.value, { ...category, count: 0 }]));

	let totalMemoCount = 0;

	memoMap.forEach((memo) => {
		const category = memoCategoryMap.get(memo.category);
		if (!category) return;

		category.count++;
		totalMemoCount++;
	});

	const list = Array.from(memoCategoryMap.values());

	return { list, total: list.length, meta: { totalMemoCount } };
};
