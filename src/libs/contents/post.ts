import "server-only";
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
	const category = POST_CATEGORIES.find((category) => category.value === post.category);
	if (!category) return null;

	const tags = post.tags
		.filter(isDefined)
		.map((tag) => tagMap.get(tag))
		.filter(isDefined);

	const publishedDate = new Date(post.publishedDate).toLocaleString("ko-KR", dateTimeOptions);

	return { ...post, category, tags, publishedDate };
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

export const getPostCategoryList = async (): Promise<ListResult<PostCategoryWithCount>> => {
	const { postMap } = await getContentMap();

	const postCategoryMap = new Map(POST_CATEGORIES.map((category) => [category.value, { ...category, count: 0 }]));

	postMap.forEach((post) => {
		const category = postCategoryMap.get(post.category);
		if (!category) return;

		category.count++;
	});

	const list = Array.from(postCategoryMap.values());

	return { list, total: list.length };
};
