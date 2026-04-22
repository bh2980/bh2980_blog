import "server-only";

import { differenceInYears } from "date-fns";
import { getContentRepository } from "../get-content-repository";
import type { ListResult, Post } from "../types/contents";
import type { PostListQuery } from "../types/query";

const contentRepository = getContentRepository();

const POST_STALE_THRESHOLD_YEARS = 2;

export async function getPost(slug: string) {
	const post = await contentRepository.getPost(slug);

	if (!post) return null;

	const isStale =
		post.status === "published" &&
		!post.isEvergreen &&
		differenceInYears(Date.now(), post.publishedAt) >= POST_STALE_THRESHOLD_YEARS;

	return { ...post, isStale };
}

export async function listPosts(query: PostListQuery = {}): Promise<ListResult<Post>> {
	const postList = await contentRepository.listPosts({
		status: "published",
		...query,
	});

	return { list: postList, total: postList.length };
}

export async function listPostSlugs() {
	return await contentRepository.listPostSlugs();
}
