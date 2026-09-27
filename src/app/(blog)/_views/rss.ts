import { Feed } from "feed";
import { listPosts } from "@/libs/contents/services/post";
import { type Locale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { isDefined } from "@/utils/is-defined";

/**
 * 공개 RSS(M7-BE-2 요청 시점 생성). 언어마다 따로 만든다(v2 B4): 기본 언어는 `/rss.xml`,
 * 그 밖은 `/en/rss.xml`처럼 접두사가 붙고 그 언어 번역본이 공개된 글만 담는다.
 */
export async function buildRssResponse(locale: Locale): Promise<Response> {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const siteUrl = new URL(HOST_URL);
	const feedUrl = new URL(localizePath(locale, "/rss.xml"), siteUrl).href;
	const homeUrl = new URL(localizePath(locale, "/"), siteUrl).href;
	const faviconUrl = new URL("/favicon.ico", siteUrl).href;

	const postList = await listPosts({}, locale);
	const items = [...postList.list]
		.map((post) => {
			if (post.status !== "published") return null;

			const date = new Date(post.publishedAt);
			if (Number.isNaN(date.getTime())) return null;

			return { ...post, date };
		})
		.filter(isDefined)
		.sort((a, b) => b.date.getTime() - a.date.getTime());

	const feed = new Feed({
		title: "bh2980.dev",
		description: translator(locale)("site.description"),
		id: homeUrl,
		link: homeUrl,
		language: locale,
		feedLinks: {
			rss2: feedUrl,
		},
		author: {
			name: "bh2980",
			link: siteUrl.href,
		},
		favicon: faviconUrl,
		updated: items[0]?.date ?? new Date(),
	});

	for (const post of items) {
		const url = new URL(localizePath(locale, `/posts/${post.slug}`), siteUrl).href;

		feed.addItem({
			title: post.title,
			id: url,
			link: url,
			description: post.excerpt ?? "",
			date: post.date,
		});
	}

	return new Response(feed.rss2(), {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"X-Robots-Tag": "noindex, follow",
			// 피드도 캐시하지 않는다. 보관·slug 변경이 다음 요청에 반영되어야 한다(M7-BE-2 / R1 지적).
			"Cache-Control": "no-store",
		},
	});
}
