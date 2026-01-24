import { sanitizeSlug } from "@/keystatic/libs/slug";
import { getPostList } from "@/libs/contents/post";

function escapeXml(s: string) {
	return s
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export async function GET() {
	const HOST_URL = process.env.HOST_URL;
	if (!HOST_URL) throw new Error("HOST_URL is required");

	const postList = await getPostList();

	const items = [...postList.list].sort((a, b) =>
		(b.publishedDateTimeISO ?? "").localeCompare(a.publishedDateTimeISO ?? ""),
	);

	const itemsXml = items
		.map((post) => {
			const link = new URL(`/posts/${sanitizeSlug(post.slug)}`, HOST_URL).href;
			const pubDate = new Date(post.publishedDateTimeISO).toUTCString();
			return `<item>
<title>${escapeXml(post.title)}</title>
<description>${escapeXml(post.excerpt ?? "")}</description>
<link>${link}</link>
<guid isPermaLink="true">${link}</guid>
<pubDate>${pubDate}</pubDate>
</item>`;
		})
		.join("");

	const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>bh2980.dev</title>
<description>bh2980의 개발 블로그</description>
<link>${HOST_URL}</link>
${itemsXml}
</channel>
</rss>`;

	return new Response(rssFeed, {
		headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
	});
}
