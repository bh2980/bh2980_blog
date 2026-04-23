import type { MetadataRoute } from "next";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";

// TODO : 추후 updatedAt을 추가 후 수정
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const posts = await listPosts();
	const memos = await listMemos();

	const postsSitemap = posts.list.map<MetadataRoute.Sitemap[number]>((post) => {
		const lastModified = post.status === "published" ? post.publishedAt : undefined;

		return {
			url: new URL(`${HOST_URL}/posts/${post.slug}`).toString(),
			lastModified,
		};
	});

	const memoSitemap = memos.list.map<MetadataRoute.Sitemap[number]>((memo) => {
		const lastModified = memo.status === "published" ? memo.publishedAt : undefined;

		return {
			url: new URL(`${HOST_URL}/memos/${memo.slug}`).toString(),
			lastModified,
		};
	});

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
