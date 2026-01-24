import { Feed } from "feed";
import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPostList } from "@/libs/contents/post";
import { isDefined } from "@/utils/is-defined";

export async function GET() {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const siteUrl = new URL(HOST_URL);
	const feedUrl = new URL("/rss.xml", siteUrl).href;
	const faviconUrl = new URL("/favicon.ico", siteUrl).href;

	const postList = await getPostList();
	const items = [...postList.list]
		.map((post) => {
			if (!post.publishedDateTimeISO) return null;

			const date = new Date(post.publishedDateTimeISO);
			if (Number.isNaN(date.getTime())) return null;

			return { ...post, date };
		})
		.filter(isDefined)
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	const feed = new Feed({
		title: "bh2980.dev",
		description: "bh2980의 개발 블로그",
		id: siteUrl.href,
		link: siteUrl.href,
		language: "ko",
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
		const url = new URL(`/posts/${sanitizeSlug(post.slug)}`, siteUrl).href;

		feed.addItem({
			title: post.title,
			id: url,
			link: url,
			description: post.excerpt ?? "",
			date: post.date,
		});
	}

	return new Response(feed.rss2(), {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8", "X-Robots-Tag": "noindex, follow" },
	});
}
