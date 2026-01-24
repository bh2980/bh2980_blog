import "server-only";
import { normalizeKstIsoString } from "@/keystatic/libs/normalize-kst-iso-string";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import type { MemoEntry } from "@/keystatic/types";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type { ListResult, Memo, Tag, WithSlug } from "./types";

const normalizeMemo = (
	memo: WithSlug<MemoEntry>,
	map: { tagMap: Map<string, Tag> },
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Memo | null => {
	const tags = memo.tags
		.filter(isDefined)
		.map((tag) => map.tagMap.get(tag))
		.filter(isDefined);

	const publishedDateTimeISO = normalizeKstIsoString(memo.publishedDateTimeISO);
	const publishedAt = new Date(publishedDateTimeISO).toLocaleString("ko-KR", dateTimeOptions);

	return { ...memo, tags, publishedAt, publishedDateTimeISO };
};

export const getMemo = async (slug: string): Promise<Memo | null> => {
	const { memoMap, tagMap } = await getContentMap();

	const memo = memoMap.get(sanitizeSlug(slug));
	if (!memo) {
		return null;
	}

	return normalizeMemo(
		memo,
		{ tagMap },
		{
			dateStyle: "medium",
			timeStyle: "short",
		},
	);
};

export const getMemoList = async (): Promise<ListResult<Omit<Memo, "content">>> => {
	const { memoMap, tagMap } = await getContentMap();

	const memos = Array.from(memoMap.values()).toSorted(
		(a, b) => new Date(b.publishedDateTimeISO).getTime() - new Date(a.publishedDateTimeISO).getTime(),
	);

	const list = memos
		.map((memo) => normalizeMemo(memo, { tagMap }, { dateStyle: "short" }))
		.filter(isDefined)
		.map(({ content, ...rest }) => rest);

	return { list, total: list.length };
};

export const getMemoTagList = async (): Promise<ListResult<Tag>> => {
	const { memoMap, tagMap } = await getContentMap();

	const tagSet = new Set<string>();

	memoMap.forEach((memo) => {
		memo.tags.forEach((tag) => {
			if (!tag) return;

			tagSet.add(tag);
		});
	});

	const list = Array.from(tagSet, (tag) => tagMap.get(tag)).filter(isDefined);

	return { list, total: list.length };
};
