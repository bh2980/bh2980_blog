import "server-only";
import { differenceInYears } from "date-fns";
import { draftMode } from "next/headers";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import type { PostEntry } from "@/keystatic/types";
import keystaticConfig from "@/root/keystatic.config";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type {
	ListOptions,
	ListResult,
	Post,
	PostCategory,
	PostCategoryListMeta,
	PostCategoryWithCount,
	Tag,
	WithSlug,
} from "./types";

const normalizePost = async (
	post: WithSlug<PostEntry>,
	map: { postCategoryMap: Map<string, PostCategory>; tagMap: Map<string, Tag> },
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Promise<Post | null> => {
	const isDraftEnabled = (await draftMode()).isEnabled;

	if (!isDraftEnabled && keystaticConfig.storage.kind === "github" && post.status === "draft") return null;

	if (!post.category) {
		return null;
	}

	const category = map.postCategoryMap.get(post.category);

	if (!category) return null;

	const tags = post.tags
		.filter(isDefined)
		.map((tag) => map.tagMap.get(tag))
		.filter(isDefined);

	const now = new Date();
	const publishedDate = new Date(post.publishedDateTimeISO);
	const publishedAt = publishedDate.toLocaleString("ko-KR", dateTimeOptions);

	const isDeprecated = post.policy.discriminant === "deprecated";
	const replacementPost = post.policy.value?.replacementPost || undefined;

	const STALE_POST_YEARS_THRESHOLD = 2;
	const yearsOld = differenceInYears(now, publishedDate);
	const isStale = !isDeprecated && post.policy.discriminant !== "evergreen" && yearsOld >= STALE_POST_YEARS_THRESHOLD;

	return { ...post, category, tags, publishedAt, isStale, isDeprecated, replacementPost };
};

export const getPost = async (slug: string): Promise<Post | null> => {
	const { postMap, tagMap, postCategoryMap } = await getContentMap();

	const post = postMap.get(sanitizeSlug(slug));
	if (!post) {
		return null;
	}

	return normalizePost(
		post,
		{ postCategoryMap, tagMap },
		{
			dateStyle: "medium",
		},
	);
};

export const getPostList = async ({
	category: categoryFilter,
}: ListOptions = {}): Promise<ListResult<Omit<Post, "content">>> => {
	const { postMap, tagMap, postCategoryMap } = await getContentMap();

	let postList = Array.from(postMap.values()).toSorted(
		(a, b) => new Date(b.publishedDateTimeISO).getTime() - new Date(a.publishedDateTimeISO).getTime(),
	);

	if (categoryFilter) {
		postList = postList.filter((post) => post.category === categoryFilter);
	}

	const list = (
		await Promise.all(postList.map((post) => normalizePost(post, { postCategoryMap, tagMap }, { dateStyle: "medium" })))
	)
		.filter(isDefined)
		.map(({ content, ...rest }) => rest);

	return { list, total: list.length };
};

export const getPostCategoryList = async (): Promise<ListResult<PostCategoryWithCount, PostCategoryListMeta>> => {
	const { postMap, postCategoryMap } = await getContentMap();

	const postCategoryCountMap = new Map(
		Array.from(postCategoryMap.values()).map((category) => [category.slug, { ...category, count: 0 }]),
	);

	let totalPostCount = 0;

	postMap.forEach((post) => {
		if (!post.category) {
			return;
		}

		const category = postCategoryCountMap.get(post.category);
		if (post.status === "draft" || !category) return;

		category.count++;
		totalPostCount++;
	});

	const list = Array.from(postCategoryCountMap.values());

	return { list, total: list.length, meta: { totalPostCount } };
};
