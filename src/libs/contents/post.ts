import "server-only";
import { differenceInYears } from "date-fns";
import { POST_CATEGORIES } from "@/keystatic/collections";
import type { PostEntry } from "@/keystatic/types";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";
import type { ListOptions, ListResult, Post, PostCategoryWithCount, Tag } from "./types";

const normalizePost = (
	post: PostEntry,
	tagMap: Map<string, Tag>,
	dateTimeOptions: Intl.DateTimeFormatOptions,
): Post | null => {
	if (post.status === "draft") return null;

	const category = POST_CATEGORIES.find((category) => category.value === post.category);
	if (!category) return null;

	const tags = post.tags
		.filter(isDefined)
		.map((tag) => tagMap.get(tag))
		.filter(isDefined);

	const now = new Date();
	const publishedAt = new Date(post.publishedDate);
	const publishedDate = publishedAt.toLocaleString("ko-KR", dateTimeOptions);

	const isDeprecated = post.policy.discriminant === "deprecated";
	const replacementPost = post.policy.value?.replacementPost || undefined;

	const STALE_POST_YEARS_THRESHOLD = 2;
	const yearsOld = differenceInYears(now, publishedAt);
	const isStale = !isDeprecated && post.policy.discriminant !== "evergreen" && yearsOld >= STALE_POST_YEARS_THRESHOLD;

	return { ...post, category, tags, publishedDate, isStale, isDeprecated, replacementPost };
};

export const getPost = async (slug: string): Promise<Post | null> => {
	const { postMap, tagMap } = await getContentMap();

	const post = postMap.get(slug);
	if (!post) {
		return null;
	}

	return normalizePost(post, tagMap, {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

export const getPostList = async ({ category: categoryFilter }: ListOptions = {}): Promise<ListResult<Post>> => {
	const { postMap, tagMap } = await getContentMap();

	let postList = Array.from(postMap.values()).toSorted(
		(a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime(),
	);

	if (categoryFilter) {
		postList = postList.filter((post) => post.category === categoryFilter);
	}

	const list = postList.map((post) => normalizePost(post, tagMap, { dateStyle: "short" })).filter(isDefined);

	return { list, total: list.length };
};

type PostCategoryListMeta = { totalPostCount: number };

export const getPostCategoryList = async (): Promise<ListResult<PostCategoryWithCount, PostCategoryListMeta>> => {
	const { postMap } = await getContentMap();

	const postCategoryMap = new Map(POST_CATEGORIES.map((category) => [category.value, { ...category, count: 0 }]));

	let totalPostCount = 0;

	postMap.forEach((post) => {
		const category = postCategoryMap.get(post.category);
		if (post.status === "draft" || !category) return;

		category.count++;
		totalPostCount++;
	});

	const list = Array.from(postCategoryMap.values());

	return { list, total: list.length, meta: { totalPostCount } };
};
