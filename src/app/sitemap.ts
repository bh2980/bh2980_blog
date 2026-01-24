import type { MetadataRoute } from "next";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemoList } from "@/libs/contents/memo";
import { getPostList } from "@/libs/contents/post";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const posts = await getPostList();
	const memos = await getMemoList();

	const postsSitemap = posts.list.map<MetadataRoute.Sitemap[number]>((post) => ({
		url: new URL(`${HOST_URL}/posts/${sanitizeSlug(post.slug)}`).toString(),
		lastModified: post.publishedDateTimeISO,
	}));

	const memoSitemap = memos.list.map<MetadataRoute.Sitemap[number]>((memo) => ({
		url: new URL(`${HOST_URL}/memos/${sanitizeSlug(memo.slug)}`).toString(),
		lastModified: memo.publishedDateTimeISO,
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
