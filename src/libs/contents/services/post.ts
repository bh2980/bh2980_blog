import "server-only";

import { getContentRepository } from "../get-content-repository";
import type { ListResult, Post } from "../types/contents";
import type { PostListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getPost(slug: string) {
	return await contentRepository.getPost(slug);
}

export async function listPosts(query: PostListQuery = {}): Promise<ListResult<Post>> {
	const postList = await contentRepository.listPosts({
		status: "published",
		...query,
	});

	postList.sort((a, b) => {
		const aTime = a.status === "published" ? new Date(a.publishedAt).getTime() : 0;
		const bTime = b.status === "published" ? new Date(b.publishedAt).getTime() : 0;

		return bTime - aTime;
	});

	return { list: postList, total: postList.length };
}

export async function listPostSlugs() {
	return await contentRepository.listPostSlugs();
}
