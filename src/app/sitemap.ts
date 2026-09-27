import type { MetadataRoute } from "next";
import { listMemos } from "@/libs/contents/services/memo";
import { listPosts } from "@/libs/contents/services/post";
import { buildSitemapEntries } from "@/libs/contents/sitemap-entries";
import { LOCALES } from "@/libs/i18n/locales";

// 공개 주소 목록을 요청 시점에 생성한다(M7-BE-2).
export const dynamic = "force-dynamic";

// TODO : 추후 updatedAt을 추가 후 수정
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	// 모든 언어의 공개 글을 담는다(v2 B4). 번역이 없는 언어에는 그 글이 없다.
	const [posts, memos] = await Promise.all([
		Promise.all(LOCALES.map((locale) => listPosts({}, locale))),
		Promise.all(LOCALES.map((locale) => listMemos({}, locale))),
	]);

	return buildSitemapEntries({
		hostUrl: HOST_URL,
		posts: posts.flatMap((result) => result.list),
		memos: memos.flatMap((result) => result.list),
	});
}
