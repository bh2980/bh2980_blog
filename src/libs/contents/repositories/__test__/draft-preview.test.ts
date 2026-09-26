import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M9-FE-1: 관리자 전용 초안 미리보기 모듈.
 *
 * 공개 조회와 **같은 slug 정규화**를 쓰고, PostgreSQL 초안을 미리보기에서 읽는다.
 */
const state = vi.hoisted(() => ({
	slugCalls: [] as { collection: string; slug: string }[],
	taxonomyCalls: 0,
	entries: new Map<string, unknown>(),
	taxonomy: [] as unknown[],
}));

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		getWorkingEntryBySlug: async (params: { collection: string; slug: string }) => {
			state.slugCalls.push(params);
			return state.entries.get(`${params.collection}:${params.slug}`) ?? null;
		},
		listPublishedEntries: async () => {
			state.taxonomyCalls += 1;
			return state.taxonomy;
		},
	}),
}));

import { getDraftPreviewMemo, getDraftPreviewPost } from "../draft-preview";

const workingEntry = (metadata: Record<string, unknown>, mdx = "편집 중 본문", workingSlug: string | null = null) => ({
	id: "11111111-1111-5111-8111-111111111111",
	collection: "post",
	status: "draft",
	version: 1,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	workingSlug,
	publishedSlug: null,
	working: {
		metadata,
		mdx,
		schemaVersion: 1,
		contentHash: "hash",
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	},
});

beforeEach(() => {
	state.slugCalls = [];
	state.taxonomyCalls = 0;
	state.entries = new Map();
	state.taxonomy = [
		{ id: "cat-1", collection: "category", slug: "dev", metadata: { title: "개발" } },
		{ id: "tag-1", collection: "tag", slug: "ts", metadata: { title: "TypeScript" } },
	];
});

describe("draft preview (M9-FE-1)", () => {
	it("환경변수 없이도 관리자 초안을 미리 볼 수 있다", async () => {
		state.entries.set("memo:draft-1", workingEntry({ title: "초안 메모" }, "미리보기 본문", "draft-1"));

		await expect(getDraftPreviewMemo("draft-1")).resolves.toMatchObject({
			status: "draft",
			title: "초안 메모",
			contentMdx: "미리보기 본문",
		});
		expect(state.slugCalls).toEqual([{ collection: "memo", slug: "draft-1" }]);
	});

	it("working 항목에서 초안 글을 만든다", async () => {
		state.entries.set(
			"post:draft-1",
			workingEntry(
				{
					title: "초안 제목",
					summary: "요약",
					categoryId: "cat-1",
					tagIds: ["tag-1", "tag-missing"],
					policy: "evergreen",
					seoTitle: "SEO 제목",
				},
				"편집 중 본문",
				"draft-1",
			),
		);

		const post = await getDraftPreviewPost("draft-1");

		expect(post).toMatchObject({
			status: "draft",
			slug: "draft-1",
			title: "초안 제목",
			excerpt: "요약",
			category: { slug: "cat-1", label: "개발" },
			contentMdx: "편집 중 본문",
			isEvergreen: true,
			seo: { title: "SEO 제목" },
		});
		// 표시 이름을 못 찾는 태그는 id를 그대로 남기고 미리보기를 막지 않는다.
		expect(post?.tags).toEqual([
			{ slug: "tag-1", label: "TypeScript" },
			{ slug: "tag-missing", label: "tag-missing" },
		]);
		expect(state.slugCalls).toEqual([{ collection: "post", slug: "draft-1" }]);
	});

	it("NFD 한글 slug도 공개 조회와 같은 NFC 규칙으로 찾는다", async () => {
		const nfc = "한글-초안";
		const nfd = nfc.normalize("NFD");
		expect(nfd).not.toBe(nfc);

		state.entries.set(`post:${nfc}`, workingEntry({ title: "한글", categoryId: "cat-1" }, "본문", nfc));

		const post = await getDraftPreviewPost(nfd);

		expect(state.slugCalls).toEqual([{ collection: "post", slug: nfc }]);
		expect(post?.slug).toBe(nfc);
	});

	it("분류가 없는 초안 글은 공개 렌더가 성립하지 않으므로 null이다", async () => {
		state.entries.set("post:no-category", workingEntry({ title: "분류 없음" }, "본문", "no-category"));

		await expect(getDraftPreviewPost("no-category")).resolves.toBeNull();
	});

	it("메모 초안은 분류 없이도 만들어진다", async () => {
		state.entries.set(
			"memo:memo-draft",
			workingEntry({ title: "메모 제목", tagIds: ["tag-1"] }, "메모 본문", "memo-draft"),
		);

		const memo = await getDraftPreviewMemo("memo-draft");

		expect(memo).toMatchObject({
			status: "draft",
			slug: "memo-draft",
			title: "메모 제목",
			contentMdx: "메모 본문",
			tags: [{ slug: "tag-1", label: "TypeScript" }],
		});
	});

	it("없는 항목은 null이다", async () => {
		await expect(getDraftPreviewPost("missing")).resolves.toBeNull();
		await expect(getDraftPreviewMemo("missing")).resolves.toBeNull();
	});
});
