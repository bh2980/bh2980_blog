import "server-only";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";

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

export const getMemoList = async () => {
	const { memoMap, memoCategoryMap } = await getContentMap();

	const list = Array.from(memoMap.keys())
		.map((slug) => {
			const memo = memoMap.get(slug);
			if (!memo) return null;

			const category = memoCategoryMap.get(memo.category);
			if (!category) return null;

			const publishedDate = new Date(memo.publishedDate).toLocaleDateString("ko-KR", {
				dateStyle: "short",
			});

			return {
				slug: memo.slug,
				title: memo.title,
				category,
				publishedDate,
			};
		})
		.filter(isDefined);

	return { list, total: list.length };
};
