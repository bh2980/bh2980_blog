import "server-only";
import type { MemoEntry } from "@/keystatic/types";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type {
	ListOptions,
	ListResult,
	Memo,
	MemoCategory,
	MemoCategoryListMeta,
	MemoCategoryWithCount,
	Tag,
	WithSlug,
} from "./types";

const normalizeMemo = (
	memo: WithSlug<MemoEntry>,
	map: { memoCategoryMap: Map<string, MemoCategory>; tagMap: Map<string, Tag> },
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Memo | null => {
	if (!memo.category) {
		return null;
	}

	const category = map.memoCategoryMap.get(memo.category);

	if (!category) {
		return null;
	}

	const tags = memo.tags
		.filter(isDefined)
		.map((tag) => map.tagMap.get(tag))
		.filter(isDefined);

	const publishedAt = new Date(memo.publishedDateTimeISO).toLocaleString("ko-KR", dateTimeOptions);

	return { ...memo, category, tags, publishedAt };
};

export const getMemo = async (slug: string): Promise<Memo | null> => {
	const { memoMap, tagMap, memoCategoryMap } = await getContentMap();

	const memo = memoMap.get(slug);
	if (!memo) {
		return null;
	}

	return normalizeMemo(
		memo,
		{ memoCategoryMap, tagMap },
		{
			dateStyle: "medium",
			timeStyle: "short",
		},
	);
};

export const getMemoList = async ({
	category: categoryFilter,
}: ListOptions = {}): Promise<ListResult<Omit<Memo, "content">>> => {
	const { memoMap, memoCategoryMap, tagMap } = await getContentMap();

	let memos = Array.from(memoMap.values()).toSorted(
		(a, b) => new Date(b.publishedDateTimeISO).getTime() - new Date(a.publishedDateTimeISO).getTime(),
	);

	if (categoryFilter) {
		memos = memos.filter((memo) => memo.category === categoryFilter);
	}

	const list = memos
		.map((memo) => normalizeMemo(memo, { memoCategoryMap, tagMap }, { dateStyle: "short" }))
		.filter(isDefined)
		.map(({ content, ...rest }) => rest);

	return { list, total: list.length };
};

export const getMemoCategoryList = async (): Promise<ListResult<MemoCategoryWithCount, MemoCategoryListMeta>> => {
	const { memoMap, memoCategoryMap } = await getContentMap();

	const memoCategoryCountMap = new Map(
		Array.from(memoCategoryMap.values()).map((category) => [category.slug, { ...category, count: 0 }]),
	);

	let totalMemoCount = 0;

	memoMap.forEach((memo) => {
		if (!memo.category) {
			return;
		}

		const category = memoCategoryCountMap.get(memo.category);
		if (!category) return;

		category.count++;
		totalMemoCount++;
	});

	const list = Array.from(memoCategoryCountMap.values());

	return { list, total: list.length, meta: { totalMemoCount } };
};
