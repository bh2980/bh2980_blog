import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ArticleFacts, ArticleStructuredData, articleMetadata } from "../structured-data";

vi.mock("@bh2980/cms/runtime", () => ({
	resolvePublicMediaUrl: async (id: string) => ({ url: `https://cdn.example/${id}.png` }),
}));

afterEach(() => vi.unstubAllEnvs());

const facts: ArticleFacts = {
	title: "SEO 해보기",
	description: "요약",
	locale: "ko",
	path: "/posts/seo",
	publishedAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-02T00:00:00.000Z",
	section: "개발",
	tags: ["SEO", "Next.js"],
};

const jsonLd = (html: string) =>
	[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) =>
		JSON.parse(match[1] ?? "null"),
	);

describe("글 검색 정보(v3 SEO)", () => {
	it("OG 글 정보에 발행·수정 시각·분류·태그를 담고, 숨긴 글만 robots noindex다", () => {
		expect(articleMetadata(facts)).toEqual({
			openGraph: {
				type: "article",
				publishedTime: facts.publishedAt,
				modifiedTime: facts.updatedAt,
				section: "개발",
				tags: ["SEO", "Next.js"],
				authors: ["bh2980"],
			},
		});
		expect(articleMetadata({ ...facts, seo: { noindex: true } }).robots).toEqual({ index: false, follow: true });
	});

	it("구조화 데이터는 글과 경로를 절대 주소로 내고, 고른 공유 이미지를 싣는다", async () => {
		vi.stubEnv("HOST_URL", "https://bh2980.dev");
		const element = await ArticleStructuredData({
			facts: { ...facts, seo: { ogImageId: "m1" } },
			list: { name: "posts.title", path: "/posts" },
		});
		const [article, breadcrumb] = jsonLd(renderToStaticMarkup(element));
		expect(article).toMatchObject({
			"@type": "BlogPosting",
			headline: "SEO 해보기",
			url: "https://bh2980.dev/posts/seo",
			datePublished: facts.publishedAt,
			dateModified: facts.updatedAt,
			keywords: "SEO, Next.js",
			image: ["https://cdn.example/m1.png"],
		});
		expect(breadcrumb.itemListElement.map((item: { item: string }) => item.item)).toEqual([
			"https://bh2980.dev/",
			"https://bh2980.dev/posts",
			"https://bh2980.dev/posts/seo",
		]);
	});

	it("검색엔진에 숨긴 글은 구조화 데이터를 내지 않는다", async () => {
		vi.stubEnv("HOST_URL", "https://bh2980.dev");
		expect(
			await ArticleStructuredData({
				facts: { ...facts, seo: { noindex: true } },
				list: { name: "posts.title", path: "/posts" },
			}),
		).toBeNull();
	});
});
