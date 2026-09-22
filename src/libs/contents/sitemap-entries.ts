import type { MetadataRoute } from "next";
import type { Memo, Post } from "./types/contents";

export type SitemapSource = {
	hostUrl: string;
	posts: readonly Post[];
	memos: readonly Memo[];
};

/**
 * M7-FE-2: sitemap 항목 생성.
 *
 * custom canonical(`seo.canonicalUrl`)을 지정한 글은 대표 주소를 다른 곳으로 선언한 것이므로
 * 자기 sitemap에서 뺀다. 공개 여부는 호출자가 이미 좁혀 놓은 목록을 신뢰한다(비공개 글은 여기 오지 않는다).
 */
export function buildSitemapEntries({ hostUrl, posts, memos }: SitemapSource): MetadataRoute.Sitemap {
	const postEntries = posts
		.filter((post) => !post.seo?.canonicalUrl)
		.map<MetadataRoute.Sitemap[number]>((post) => ({
			url: new URL(`${hostUrl}/posts/${post.slug}`).toString(),
			lastModified: post.status === "published" ? post.publishedAt : undefined,
		}));

	const memoEntries = memos
		.filter((memo) => !memo.seo?.canonicalUrl)
		.map<MetadataRoute.Sitemap[number]>((memo) => ({
			url: new URL(`${hostUrl}/memos/${memo.slug}`).toString(),
			lastModified: memo.status === "published" ? memo.publishedAt : undefined,
		}));

	return [
		{
			url: hostUrl,
		},
		{
			url: `${hostUrl}/posts`,
		},
		{
			url: `${hostUrl}/memos`,
		},
		...postEntries,
		...memoEntries,
	];
}
