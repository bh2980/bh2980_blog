import "server-only";
import { isDefined } from "@/utils";
import { getContentMap } from "./store";

export const getPost = async (slug: string) => {
	const { postMap, postCategoryMap, tagMap } = await getContentMap();

	const post = postMap.get(slug);
	if (!post) {
		return null;
	}

	const category = postCategoryMap.get(post.category);

	if (!category) {
		return null;
	}

	const tags = post.tags
		.filter(isDefined)
		.map((tag) => tagMap.get(tag))
		.filter(isDefined);

	const publishedDate = new Date(post.publishedDate).toLocaleString("ko-KR", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	return { ...post, category, tags, publishedDate };
};

export const getPostList = async () => {
	const { postMap, postCategoryMap } = await getContentMap();

	const list = Array.from(postMap.keys())
		.map((slug) => {
			const post = postMap.get(slug);
			if (!post) return null;

			const category = postCategoryMap.get(post.category);
			if (!category) return null;

			const publishedDate = new Date(post.publishedDate).toLocaleDateString("ko-KR", {
				dateStyle: "short",
			});

			return {
				slug: post.slug,
				title: post.title,
				category,
				publishedDate,
			};
		})
		.filter(isDefined);

	return { list, total: list.length };
};
