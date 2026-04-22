import "server-only";

import { KeystaticRepository } from "../repositories/keystatic";
import type { ListResult, Post } from "../types/contents";

const contentRepository = new KeystaticRepository();

export async function getPost(slug: string) {
	const post = await contentRepository.getPost(slug);

	return post;
}

export async function getPostList(): Promise<ListResult<Post>> {
	const postList = await contentRepository.listPosts();

	return { list: postList, total: postList.length };
}

export const getPostSlugs = async () => {
	return await contentRepository.listPostSlugs();
};
