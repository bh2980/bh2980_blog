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

	it("canonical이 없으면 SEO 제목만 있어도 포함한다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [post("c", { title: "검색 제목" })], memos: [] });

		expect(entries.map((entry) => entry.url)).toContain(`${HOST}/posts/c`);
	});

	it("글·메모가 없어도 기본 주소 3개는 남는다", () => {
		const entries = buildSitemapEntries({ hostUrl: HOST, posts: [], memos: [] });

		expect(entries.map((entry) => entry.url)).toEqual([HOST, `${HOST}/posts`, `${HOST}/memos`]);
	});
});
