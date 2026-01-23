import type { MetadataRoute } from "next";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getMemoList } from "@/libs/contents/memo";
import { getPostList } from "@/libs/contents/post";

// NOTE : 타임존 에러 임시 fix
function normalizeKstIsoString(iso: string) {
	// Assumes the stored ISO string represents KST local clock time but incorrectly ends with `Z`.
	// Convert it to an ISO 8601 datetime with explicit KST offset (e.g. `2026-01-12T12:40:00+09:00`).
	const noZ = iso.endsWith("Z") ? iso.slice(0, -1) : iso;
	const noMs = noZ.replace(/\.\d{3}$/, "");
	return `${noMs}+09:00`;
}

// TODO : datetime 타임존 에러 수정 - keystatic의 field를 직접 만들어야함.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const posts = await getPostList();
	const memos = await getMemoList();

	const postsSitemap = posts.list.map<MetadataRoute.Sitemap[number]>((post) => ({
		url: new URL(`${HOST_URL}/posts/${sanitizeSlug(post.slug)}`).toString(),
		lastModified: normalizeKstIsoString(post.publishedDateTimeISO),
	}));

	const memoSitemap = memos.list.map<MetadataRoute.Sitemap[number]>((memo) => ({
		url: new URL(`${HOST_URL}/memos/${sanitizeSlug(memo.slug)}`).toString(),
		lastModified: normalizeKstIsoString(memo.publishedDateTimeISO),
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
