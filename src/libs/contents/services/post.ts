import "server-only";

import { compareDesc } from "date-fns";
import { verifyAccess } from "@/libs/admin/verify-access";
import { getContentRepository } from "../get-content-repository";
import type { ListResult, Post, PublishedPost } from "../types/contents";
import type { PostListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getPost(slug: string) {
	const post = await contentRepository.getPost(slug);

	if (post?.status === "draft") return null;

	return post;
}

export async function listPosts(query: Omit<PostListQuery, "status"> = {}): Promise<ListResult<PublishedPost>> {
	const postList = await contentRepository.listPosts({
		...query,
		status: "published",
	});

	const publishedPostList = postList
		.filter((post): post is PublishedPost => post.status === "published")
		.sort((a, b) => compareDesc(a.publishedAt, b.publishedAt));

	return { list: publishedPostList, total: publishedPostList.length };
}

export async function listPostSlugs() {
	return await contentRepository.listPostSlugs();
}

export async function getPreviewPost(slug: string) {
	const isAdmin = await verifyAccess();

	if (!isAdmin) return null;

	return await contentRepository.getPost(slug);
}

export async function listPreviewPosts(query: PostListQuery = {}): Promise<ListResult<Post>> {
	const isAdmin = await verifyAccess();

	if (!isAdmin) {
		return { list: [], total: 0 };
	}

	const postList = await contentRepository.listPosts(query);

	return { list: postList, total: postList.length };
}
