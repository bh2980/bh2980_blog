import { describe, expect, it, vi } from "vitest";

vi.mock("@/libs/contents/get-content-repository", () => ({
	getContentRepository: () => ({
		listLocalizedAddresses: async () =>
			new Map([
				["post:hello", "hello-en"],
				["post:한글-글", "한글-글-en"],
				["memo:note", "note-en"],
			]),
	}),
}));

import { createLocalizedLinkResolver } from "../localized-links";

describe("본문 내부 링크의 언어 바꾸기(v2 B4)", () => {
	it("기본 언어는 그대로 둔다", async () => {
		const resolve = await createLocalizedLinkResolver("ko");

		expect(resolve("/posts/hello")).toBe("/posts/hello");
	});

	it("번역본이 공개된 글·메모는 그 언어 주소로 바꾸고 질의·해시를 남긴다", async () => {
		const resolve = await createLocalizedLinkResolver("en");

		expect(resolve("/posts/hello")).toBe("/en/posts/hello-en");
		expect(resolve("/memos/note")).toBe("/en/memos/note-en");
		expect(resolve("/posts/hello?tab=1#top")).toBe("/en/posts/hello-en?tab=1#top");
		expect(resolve("/posts/hello#top")).toBe("/en/posts/hello-en#top");
		expect(resolve("/posts/hello/?tab=1")).toBe("/en/posts/hello-en/?tab=1");
	});

	it("퍼센트 인코딩된 한글 주소를 풀어 찾고 바뀐 주소는 다시 인코딩한다", async () => {
		const resolve = await createLocalizedLinkResolver("en");

		expect(resolve(`/posts/${encodeURIComponent("한글-글")}`)).toBe(`/en/posts/${encodeURIComponent("한글-글-en")}`);
	});

	it("번역본이 없거나 글·메모 주소가 아니면 그대로 둔다", async () => {
		const resolve = await createLocalizedLinkResolver("en");

		expect(resolve("/posts/untranslated")).toBe("/posts/untranslated");
		expect(resolve("/posts")).toBe("/posts");
		expect(resolve("/posts/hello/")).toBe("/posts/hello/");
		expect(resolve("/posts/hello/extra")).toBe("/posts/hello/extra");
		expect(resolve("/about")).toBe("/about");
		expect(resolve("https://example.com/posts/hello")).toBe("https://example.com/posts/hello");
		expect(resolve("/posts/%E0%A4%A")).toBe("/posts/%E0%A4%A");
	});
});
