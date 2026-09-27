import "server-only";

import { compareDesc } from "date-fns";
import { canPreview } from "@/libs/admin/preview-access";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { getContentRepository } from "../get-content-repository";
import { getDraftPreviewPost } from "../repositories/draft-preview";
import type { ListResult, Post, PublishedPost } from "../types/contents";
import type { PostListQuery } from "../types/query";

const contentRepository = getContentRepository();

export async function getPost(slug: string, locale: Locale = DEFAULT_LOCALE) {
	const post = await contentRepository.getPost(slug, locale);

	if (post?.status === "draft") return null;

	return post;
}

export async function listPosts(
	query: Omit<PostListQuery, "status"> = {},
	locale: Locale = DEFAULT_LOCALE,
): Promise<ListResult<PublishedPost>> {
	const postList = await contentRepository.listPosts(
		{
			...query,
			status: "published",
		},
		locale,
	);

	const publishedPostList = postList
		.filter((post): post is PublishedPost => post.status === "published")
		.sort((a, b) => compareDesc(a.publishedAt, b.publishedAt));

	return { list: publishedPostList, total: publishedPostList.length };
}

export async function listPostSlugs(locale: Locale = DEFAULT_LOCALE) {
	return await contentRepository.listPostSlugs(locale);
}

/** 같은 번역 묶음의 공개된 언어와 주소(v2 B4). 글 화면의 `hreflang`과 언어 전환이 쓴다. */
export async function listPostTranslations(translationGroupId: string) {
	return await contentRepository.listTranslations("post", translationGroupId);
}

/**
 * 미리보기 조회. 권한 판정은 CMS 관리자 세션이다(M7-FE-1 / O1 A9).
 * 공개 `getPost`와 달리 초안을 막지 않는다. 대신 인증을 통과해야만 호출된다.
 *
 * M9-FE-1: postgres 공개 저장소는 계약상 초안을 돌려주지 않으므로, 공개 조회가 비어 있으면
 * 관리자 전용 working 본문 경로를 한 번 더 본다. 공개 경로(`getPost`)는 그대로 초안을 숨긴다.
 */
export async function getPreviewPost(slug: string, locale: Locale = DEFAULT_LOCALE) {
	const isAdmin = await canPreview();

	if (!isAdmin) return null;

	const post = await contentRepository.getPost(slug, locale);
	if (post) return post as Post;

	return await getDraftPreviewPost(slug, locale);
}

export async function listPreviewPosts(query: PostListQuery = {}): Promise<ListResult<Post>> {
	const isAdmin = await canPreview();

	if (!isAdmin) {
		return { list: [], total: 0 };
	}

	const postList = await contentRepository.listPosts(query);

	return { list: postList, total: postList.length };
}
