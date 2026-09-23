import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M9-FE-1: 관리자 전용 초안 미리보기 모듈.
 *
 * 이 테스트가 직접 증명해야 하는 두 가지(R1 P2):
 * 1. `CMS_PUBLIC_REPOSITORY`가 postgres가 아니면 **저장소를 아예 부르지 않고** null을 돌려준다.
 *    CMS DB가 설정되지 않은 배포에서 404가 500으로 바뀌지 않는다.
 * 2. 공개 조회와 **같은 slug 정규화**를 쓴다. NFD 한글 slug도 초안 미리보기가 찾는다.
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

const previousSource = process.env.CMS_PUBLIC_REPOSITORY;

beforeEach(() => {
	state.slugCalls = [];
	state.taxonomyCalls = 0;
	state.entries = new Map();
	state.taxonomy = [
		{ id: "cat-1", collection: "category", slug: "dev", metadata: { title: "개발" } },
		{ id: "tag-1", collection: "tag", slug: "ts", metadata: { title: "TypeScript" } },
	];
	delete process.env.CMS_PUBLIC_REPOSITORY;
});

afterEach(() => {
	if (previousSource === undefined) {
		delete process.env.CMS_PUBLIC_REPOSITORY;
	} else {
		process.env.CMS_PUBLIC_REPOSITORY = previousSource;
	}
});

describe("draft preview (M9-FE-1)", () => {
	it("CMS_PUBLIC_REPOSITORY가 없으면 저장소를 부르지 않고 실패한다(fail-closed)", async () => {
		await expect(getDraftPreviewPost("draft-1")).rejects.toThrow(/CMS_PUBLIC_REPOSITORY/);
		await expect(getDraftPreviewMemo("draft-1")).rejects.toThrow(/CMS_PUBLIC_REPOSITORY/);

		// DB 연결을 요구하지 않는다. 플래그 없는 배포는 조용히 404가 되지 않고 실패한다.
		expect(state.slugCalls).toEqual([]);
		expect(state.taxonomyCalls).toBe(0);
	});

	it("postgres일 때만 working 항목을 읽어 초안 글을 만든다", async () => {
		process.env.CMS_PUBLIC_REPOSITORY = "postgres";
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
		process.env.CMS_PUBLIC_REPOSITORY = "postgres";
		const nfc = "한글-초안";
		const nfd = nfc.normalize("NFD");
		expect(nfd).not.toBe(nfc);

		state.entries.set(`post:${nfc}`, workingEntry({ title: "한글", categoryId: "cat-1" }, "본문", nfc));

		const post = await getDraftPreviewPost(nfd);

		expect(state.slugCalls).toEqual([{ collection: "post", slug: nfc }]);
		expect(post?.slug).toBe(nfc);
	});

	it("분류가 없는 초안 글은 공개 렌더가 성립하지 않으므로 null이다", async () => {
		process.env.CMS_PUBLIC_REPOSITORY = "postgres";
		state.entries.set("post:no-category", workingEntry({ title: "분류 없음" }, "본문", "no-category"));

		await expect(getDraftPreviewPost("no-category")).resolves.toBeNull();
	});

	it("메모 초안은 분류 없이도 만들어진다", async () => {
		process.env.CMS_PUBLIC_REPOSITORY = "postgres";
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
		process.env.CMS_PUBLIC_REPOSITORY = "postgres";

		await expect(getDraftPreviewPost("missing")).resolves.toBeNull();
		await expect(getDraftPreviewMemo("missing")).resolves.toBeNull();
	});
});
