import type { ReadEntry, ReadRelation } from "@bh2980/cms/read";
import { describe, expect, it } from "vitest";
import { toPublishedMemo, toPublishedPost } from "../read-model";

const DATE = new Date("2026-03-01T12:00:00.000Z");

const relation = (overrides: Partial<ReadRelation> & { slug: string }): ReadRelation => ({
	id: `id-${overrides.slug}`,
	collection: "tag",
	locale: "ko",
	title: overrides.slug,
	path: null,
	...overrides,
});

function entry(overrides: Partial<ReadEntry> = {}): ReadEntry {
	return {
		id: "post-1",
		collection: "post",
		locale: "ko",
		translationGroupId: "post-1",
		slug: "hello",
		path: "/posts/hello",
		title: "안녕",
		metadata: { title: "안녕", summary: " 요약 ", policy: "evergreen" },
		relations: {
			categoryId: [relation({ slug: "engineering", collection: "category", title: "엔지니어링" })],
			tagIds: [relation({ slug: "react", title: "React" }), relation({ slug: "untitled", title: null })],
		},
		publishedAt: DATE,
		updatedAt: DATE,
		mdx: "# 본문",
		fallback: false,
		...overrides,
	} as ReadEntry;
}

describe("읽기 API 결과 → 블로그 모양", () => {
	it("게시글에 카테고리·태그·요약·evergreen을 싣고 이름이 없는 태그는 주소를 이름으로 쓴다", () => {
		expect(toPublishedPost(entry())).toEqual({
			slug: "hello",
			locale: "ko",
			translationGroupId: "post-1",
			status: "published",
			title: "안녕",
			excerpt: "요약",
			category: { slug: "engineering", label: "엔지니어링" },
			tags: [
				{ slug: "react", label: "React" },
				{ slug: "untitled", label: "untitled" },
			],
			contentMdx: "# 본문",
			publishedAt: DATE.toISOString(),
			updatedAt: DATE.toISOString(),
			isEvergreen: true,
		});
	});

	it("카테고리를 해석할 수 없는 게시글은 공개하지 않는다", () => {
		expect(toPublishedPost(entry({ relations: { categoryId: [] } }))).toBeNull();
		expect(toPublishedPost(entry({ relations: {} }))).toBeNull();
	});

	it("발행 시각을 알 수 없는 항목은 공개하지 않는다", () => {
		expect(toPublishedPost(entry({ publishedAt: null }))).toBeNull();
		expect(toPublishedMemo(entry({ collection: "memo", publishedAt: null }))).toBeNull();
	});

	it("메모는 카테고리 없이도 공개되고 요약·정책을 싣지 않는다", () => {
		const memo = toPublishedMemo(entry({ collection: "memo", relations: { tagIds: [] } }));

		expect(memo).toMatchObject({ status: "published", slug: "hello", tags: [] });
		expect(Object.hasOwn(memo as object, "excerpt")).toBe(false);
		expect(Object.hasOwn(memo as object, "isEvergreen")).toBe(false);
	});

	it("지원 중단 글은 대체 글 관계가 고른 글로 안내한다", () => {
		const deprecated = entry({
			metadata: { title: "옛 글", policy: "deprecated" },
			relations: {
				categoryId: [relation({ slug: "engineering", collection: "category" })],
				replacementPostId: [relation({ slug: "new-post", collection: "post", locale: "en", title: "New post" })],
			},
		});

		expect(toPublishedPost(deprecated)?.deprecation).toEqual({
			replacement: { slug: "new-post", title: "New post", locale: "en" },
		});
		expect(
			toPublishedPost(
				entry({
					metadata: { title: "옛 글", policy: "deprecated" },
					relations: { categoryId: [relation({ slug: "engineering", collection: "category" })] },
				}),
			)?.deprecation,
		).toEqual({ replacement: null });
		expect(toPublishedPost(entry())?.deprecation).toBeUndefined();
	});
});
