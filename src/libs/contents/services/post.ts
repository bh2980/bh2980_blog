import "server-only";

import { compareDesc } from "date-fns";
import { canPreview } from "@/libs/admin/preview-access";
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

/**
 * 미리보기 조회. 권한 판정은 CMS 관리자 세션이다(M7-FE-1 / O1 A9).
 * 공개 `getPost`와 달리 초안을 막지 않는다. 대신 인증을 통과해야만 호출된다.
 */
export async function getPreviewPost(slug: string) {
	const isAdmin = await canPreview();

	if (!isAdmin) return null;

	return await contentRepository.getPost(slug);
}

export async function listPreviewPosts(query: PostListQuery = {}): Promise<ListResult<Post>> {
	const isAdmin = await canPreview();

	if (!isAdmin) {
		return { list: [], total: 0 };
	}

	const postList = await contentRepository.listPosts(query);

	return { list: postList, total: postList.length };
}
