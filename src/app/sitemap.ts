import type { MetadataRoute } from "next";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import { buildSitemapEntries } from "@/libs/contents/sitemap-entries";

// 공개 주소 목록을 요청 시점에 생성한다(M7-BE-2).
export const dynamic = "force-dynamic";

// TODO : 추후 updatedAt을 추가 후 수정
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const posts = await listPosts();
	const memos = await listMemos();

	return buildSitemapEntries({ hostUrl: HOST_URL, posts: posts.list, memos: memos.list });
}
