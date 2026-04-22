import type { MetadataRoute } from "next";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";

// TODO : 추후 updatedAt을 추가 후 수정
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const posts = await listPosts();
	const memos = await listMemos();

	const postsSitemap = posts.list.map<MetadataRoute.Sitemap[number]>((post) => ({
		url: new URL(`${HOST_URL}/posts/${sanitizeSlug(post.slug)}`).toString(),
		lastModified: post.publishedAt ?? undefined,
	}));

	const memoSitemap = memos.list.map<MetadataRoute.Sitemap[number]>((memo) => ({
		url: new URL(`${HOST_URL}/memos/${sanitizeSlug(memo.slug)}`).toString(),
		lastModified: memo.publishedAt ?? undefined,
	}));

	return [
		{
			url: HOST_URL,
		},
		{
			url: `${HOST_URL}/posts`,
		},
		{
			url: `${HOST_URL}/memos`,
		},
		...postsSitemap,
		...memoSitemap,
	];
}
