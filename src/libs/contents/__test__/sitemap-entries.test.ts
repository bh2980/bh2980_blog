import { describe, expect, it } from "vitest";
import { buildSitemapEntries } from "../sitemap-entries";
import type { Memo, Post, SeoMetadata } from "../types/contents";

const HOST = "https://example.com";

function post(slug: string, seo?: SeoMetadata): Post {
	return {
		slug,
		status: "published",
		publishedAt: "2026-03-01T12:00:00.000Z",
		title: slug,
		excerpt: "",
		category: { slug: "engineering", label: "엔지니어링" },
		tags: [],
		contentMdx: "",
		...(seo ? { seo } : {}),
	};
}

function memo(slug: string, seo?: SeoMetadata): Memo {
	return {
		slug,
		status: "published",
		publishedAt: "2026-03-01T12:00:00.000Z",
		title: slug,
		tags: [],
		contentMdx: "",
		...(seo ? { seo } : {}),
	};
}

describe("M7-FE-2 sitemap 항목", () => {
	it("기본 주소 3개와 공개 글·메모를 담는다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [post("a")], memos: [memo("m")] });

		expect(entries.map((entry) => entry.url)).toEqual([
			HOST,
			`${HOST}/posts`,
			`${HOST}/memos`,
			`${HOST}/posts/a`,
			`${HOST}/memos/m`,
		]);
	});

	it("publishedAt을 lastModified로 쓴다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [post("a")], memos: [] });
		const detail = entries.find((entry) => entry.url === `${HOST}/posts/a`);

		expect(detail?.lastModified).toBe("2026-03-01T12:00:00.000Z");
	});

	it("실수로 비공개 상태가 전달되어도 sitemap에 넣지 않는다", () => {
		const statuses = ["draft", "archived", "trash"] as const;
		const posts = statuses.map((status) => ({ ...post(`post-${status}`), status }) as unknown as Post);
		const memos = statuses.map((status) => ({ ...memo(`memo-${status}`), status }) as unknown as Memo);
		const entries = buildSitemapEntries({ hostUrl: HOST, posts, memos });
		const urls = entries.map((entry) => entry.url);

		for (const status of statuses) {
			expect(urls).not.toContain(`${HOST}/posts/post-${status}`);
			expect(urls).not.toContain(`${HOST}/memos/memo-${status}`);
		}
	});

	it("custom canonical을 지정한 글은 sitemap에서 제외한다", () => {
		const entries = buildSitemapEntries({
			hostUrl: HOST,
			posts: [post("a"), post("b", { canonicalUrl: "https://dev.to/b" })],
			memos: [memo("m"), memo("n", { canonicalUrl: "https://dev.to/n" })],
		});
		const urls = entries.map((entry) => entry.url);

		expect(urls).toContain(`${HOST}/posts/a`);
		expect(urls).not.toContain(`${HOST}/posts/b`);
		expect(urls).toContain(`${HOST}/memos/m`);
		expect(urls).not.toContain(`${HOST}/memos/n`);
	});

	it("검색엔진에 숨긴 글은 sitemap에서 제외한다", () => {
		const entries = buildSitemapEntries({
			hostUrl: HOST,
			posts: [post("a"), post("hidden", { noindex: true })],
			memos: [],
		});
		const urls = entries.map((entry) => entry.url);

		expect(urls).toContain(`${HOST}/posts/a`);
		expect(urls).not.toContain(`${HOST}/posts/hidden`);
	});

	it("canonical이 없으면 SEO 제목만 있어도 포함한다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [post("c", { title: "검색 제목" })], memos: [] });

		expect(entries.map((entry) => entry.url)).toContain(`${HOST}/posts/c`);
	});

	it("글·메모가 없어도 기본 주소 3개는 남는다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [], memos: [] });

		expect(entries.map((entry) => entry.url)).toEqual([HOST, `${HOST}/posts`, `${HOST}/memos`]);
	});
});

describe("v2 B4 언어별 sitemap", () => {
	it("번역본 주소를 담고 같은 글끼리 hreflang으로 잇는다(기본 언어가 x-default)", () => {
		const ko = { ...post("hello"), locale: "ko" as const, translationGroupId: "g1" };
		const en = { ...post("hello"), locale: "en" as const, translationGroupId: "g1" };
		const solo = { ...post("only-ko"), locale: "ko" as const, translationGroupId: "g2" };
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [ko, en, solo], memos: [] });

		expect(entries.map((entry) => entry.url)).toEqual([
			HOST,
			`${HOST}/en`,
			`${HOST}/posts`,
			`${HOST}/en/posts`,
			`${HOST}/memos`,
			`${HOST}/en/memos`,
			`${HOST}/posts/hello`,
			`${HOST}/en/posts/hello`,
			`${HOST}/posts/only-ko`,
		]);
		const english = entries.find((entry) => entry.url === `${HOST}/en/posts/hello`);
		expect(english?.alternates?.languages).toEqual({
			ko: `${HOST}/posts/hello`,
			en: `${HOST}/en/posts/hello`,
			"x-default": `${HOST}/posts/hello`,
		});
		expect(entries.find((entry) => entry.url === `${HOST}/posts/only-ko`)?.alternates).toBeUndefined();
	});
});
