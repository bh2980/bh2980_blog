import type { ReadEntry, ReadRelation } from "@monti-cms/core/read";
import { describe, expect, it } from "vitest";
import { toPublicEntryDto } from "../public-api";

const DATE = new Date("2026-03-01T12:00:00.000Z");

const relation = (slug: string, title: string, collection = "tag"): ReadRelation => ({
	id: `id-${slug}`,
	collection,
	locale: "ko",
	slug,
	title,
	path: null,
});

function entry(collection: "post" | "memo", overrides: Partial<ReadEntry> = {}): ReadEntry {
	return {
		id: "id-1",
		collection,
		locale: "ko",
		translationGroupId: "id-1",
		slug: "hello",
		path: null,
		title: "안녕",
		metadata: collection === "post" ? { title: "안녕", summary: "요약", policy: "evergreen" } : { title: "안녕" },
		relations: {
			tagIds: [relation("typescript", "TypeScript")],
			...(collection === "post" ? { categoryId: [relation("engineering", "엔지니어링", "category")] } : {}),
		},
		publishedAt: DATE,
		updatedAt: DATE,
		mdx: "# 본문",
		fallback: false,
		...overrides,
	} as ReadEntry;
}

/** 숨기지 않는 글의 DTO(테스트 표본은 모두 공개 조건을 갖춘다). */
const dtoOf = (...args: Parameters<typeof toPublicEntryDto>) => {
	const dto = toPublicEntryDto(...args);
	if (!dto) throw new Error("hidden");
	return dto;
};

describe("M7-BE-3 공개 DTO", () => {
	it("목록 직렬화에는 본문이 없다", () => {
		const dto = dtoOf(entry("post"), { body: false });

		expect(Object.hasOwn(dto, "body")).toBe(false);
		expect(JSON.stringify(dto)).not.toContain("본문");
	});

	it("상세 직렬화에는 본문이 있다", () => {
		expect(dtoOf(entry("post"), { body: true }).body).toBe("# 본문");
		expect(dtoOf(entry("memo"), { body: true }).body).toBe("# 본문");
	});

	it("공개 응답에 관리자 전용 키가 없다", () => {
		const keys = Object.keys(dtoOf(entry("post"), { body: true }));

		for (const forbidden of [
			"version",
			"folderId",
			"working",
			"published",
			"status",
			"contentMdx",
			"createdAt",
			"updatedAt",
			"id",
			"metadata",
			"relations",
		]) {
			expect(keys).not.toContain(forbidden);
		}
	});

	it("post는 요약·카테고리·evergreen을 싣고 memo는 싣지 않는다", () => {
		expect(dtoOf(entry("post"), { body: false })).toEqual({
			collection: "post",
			slug: "hello",
			title: "안녕",
			publishedAt: DATE.toISOString(),
			tags: [{ slug: "typescript", label: "TypeScript" }],
			excerpt: "요약",
			category: { slug: "engineering", label: "엔지니어링" },
			isEvergreen: true,
		});

		const memoDto = dtoOf(entry("memo"), { body: false });
		expect(memoDto).toEqual({
			collection: "memo",
			slug: "hello",
			title: "안녕",
			publishedAt: DATE.toISOString(),
			tags: [{ slug: "typescript", label: "TypeScript" }],
		});
	});

	it("SEO 메타는 입력했을 때만 실린다", () => {
		expect(Object.hasOwn(dtoOf(entry("post"), { body: false }), "seo")).toBe(false);

		const dto = dtoOf(
			entry("post", { metadata: { title: "안녕", seoTitle: "검색 제목", canonicalUrl: "/posts/hello" } }),
			{ body: false },
		);

		expect(dto.seo).toEqual({ title: "검색 제목", canonicalUrl: "/posts/hello" });
	});

	it("카테고리를 풀 수 없는 게시글·발행일이 없는 글은 숨긴다(null)", () => {
		expect(toPublicEntryDto(entry("post", { relations: {} }), { body: false })).toBeNull();
		expect(toPublicEntryDto(entry("memo", { publishedAt: null }), { body: false })).toBeNull();
	});
});
