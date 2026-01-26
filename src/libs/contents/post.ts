import "server-only";
import { differenceInYears } from "date-fns";
import { draftMode } from "next/headers";
import { normalizeKstIsoString } from "@/keystatic/libs/normalize-kst-iso-string";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import type { PostEntry } from "@/keystatic/types";
import keystaticConfig from "@/root/keystatic.config";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type { Category, ListOptions, ListResult, Post, Tag, WithSlug } from "./types";

const normalizePost = async (
	post: WithSlug<PostEntry>,
	map: { categoryMap: Map<string, Category>; tagMap: Map<string, Tag> },
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Promise<Post | null> => {
	const isDraftEnabled = (await draftMode()).isEnabled;

	if (!isDraftEnabled && keystaticConfig.storage.kind === "github" && post.status === "draft") return null;

	if (!post.category) {
		return null;
	}

	const category = map.categoryMap.get(post.category);

	if (!category) return null;

	const tags = post.tags
		.filter(isDefined)
		.map((tag) => map.tagMap.get(tag))
		.filter(isDefined);

	const now = new Date();
	const publishedDateTimeISO = normalizeKstIsoString(post.publishedDateTimeISO);
	const publishedDate = new Date(publishedDateTimeISO);
	const publishedAt = publishedDate.toLocaleString("ko-KR", dateTimeOptions);

	const isDeprecated = post.policy.discriminant === "deprecated";
	const replacementPost = post.policy.value?.replacementPost || undefined;

	const STALE_POST_YEARS_THRESHOLD = 2;
	const yearsOld = differenceInYears(now, publishedDate);
	const isStale = !isDeprecated && post.policy.discriminant !== "evergreen" && yearsOld >= STALE_POST_YEARS_THRESHOLD;

	return { ...post, category, tags, publishedDateTimeISO, publishedAt, isStale, isDeprecated, replacementPost };
};

export const getPost = async (slug: string): Promise<Post | null> => {
	const { postMap, tagMap, categoryMap } = await getContentMap();

	const post = postMap.get(sanitizeSlug(slug));
	if (!post) {
		return null;
	}

	return normalizePost(
		post,
		{ categoryMap, tagMap },
		{
			dateStyle: "medium",
		},
	);
};

export const getPostList = async ({
	category: categoryFilter,
}: ListOptions = {}): Promise<ListResult<Omit<Post, "content">>> => {
	const { postMap, tagMap, categoryMap } = await getContentMap();

	let postList = Array.from(postMap.values()).toSorted(
		(a, b) => new Date(b.publishedDateTimeISO).getTime() - new Date(a.publishedDateTimeISO).getTime(),
	);

	if (categoryFilter) {
		postList = postList.filter((post) => post.category === categoryFilter);
	}

	const list = (
		await Promise.all(postList.map((post) => normalizePost(post, { categoryMap, tagMap }, { dateStyle: "medium" })))
	)
		.filter(isDefined)
		.map(({ content, ...rest }) => rest);

	return { list, total: list.length };
};
