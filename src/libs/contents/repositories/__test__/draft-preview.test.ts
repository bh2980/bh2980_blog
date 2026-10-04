import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M9-FE-1: 관리자 전용 초안 미리보기 모듈.
 *
 * 공개 조회와 **같은 slug 정규화**를 쓰고, 라이브러리의 `getPreview`(최신 초안)로 초안을 읽는다.
 */
const state = vi.hoisted(() => ({
	calls: [] as { collection: string; slug: string; locale?: string }[],
	entries: new Map<string, unknown>(),
}));

vi.mock("@monti-cms/core/read", () => ({
	getPreview: async (params: { collection: string; slug: string; locale?: string }) => {
		state.calls.push(params);
		return state.entries.get(`${params.collection}:${params.slug}`) ?? null;
	},
}));

import { getDraftPreviewMemo, getDraftPreviewPost } from "../draft-preview";

const relation = (id: string, slug: string, title: string, collection: string) => ({
	id,
	collection,
	locale: "ko",
	slug,
	title,
	path: null,
});

const draft = (
	collection: "post" | "memo",
	slug: string,
	metadata: Record<string, unknown>,
	mdx: string,
	relations: Record<string, unknown[]> = {},
) => ({
	id: "11111111-1111-5111-8111-111111111111",
	collection,
	locale: "ko",
	translationGroupId: "11111111-1111-5111-8111-111111111111",
	slug,
	path: null,
	title: null,
	metadata,
	relations,
	publishedAt: null,
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	mdx,
	fallback: false,
});

beforeEach(() => {
	state.calls = [];
	state.entries = new Map();
});

describe("draft preview (M9-FE-1)", () => {
	it("관리자 초안 메모를 미리 볼 수 있다", async () => {
		state.entries.set("memo:draft-1", draft("memo", "draft-1", { title: "초안 메모" }, "미리보기 본문"));

		await expect(getDraftPreviewMemo("draft-1")).resolves.toMatchObject({
			status: "draft",
			title: "초안 메모",
			contentMdx: "미리보기 본문",
		});
		expect(state.calls).toEqual([{ collection: "memo", slug: "draft-1", locale: "ko" }]);
	});

	it("초안 글을 만들고 공개된 분류는 주소·이름으로 풀어 준다", async () => {
		state.entries.set(
			"post:draft-1",
			draft(
				"post",
				"draft-1",
				{
					title: "초안 제목",
					summary: "요약",
					categoryId: "cat-1",
					tagIds: ["tag-1", "tag-missing"],
					policy: "evergreen",
					seoTitle: "SEO 제목",
				},
				"편집 중 본문",
				{
					categoryId: [relation("cat-1", "dev", "개발", "category")],
					tagIds: [relation("tag-1", "ts", "TypeScript", "tag")],
				},
			),
		);

		const post = await getDraftPreviewPost("draft-1");

		expect(post).toMatchObject({
			status: "draft",
			slug: "draft-1",
			title: "초안 제목",
			excerpt: "요약",
			category: { slug: "dev", label: "개발" },
			contentMdx: "편집 중 본문",
			isEvergreen: true,
			seo: { title: "SEO 제목" },
		});
		// 공개되지 않아 풀리지 않는 태그는 id를 그대로 남기고 미리보기를 막지 않는다.
		expect(post?.tags).toEqual([
			{ slug: "ts", label: "TypeScript" },
			{ slug: "tag-missing", label: "tag-missing" },
		]);
	});

	it("카테고리가 아직 공개되지 않았어도 id로 미리보기를 보여 준다", async () => {
		state.entries.set("post:p", draft("post", "p", { title: "글", categoryId: "cat-new" }, "본문"));

		expect((await getDraftPreviewPost("p"))?.category).toEqual({ slug: "cat-new", label: "cat-new" });
	});

	it("NFD 한글 slug도 공개 조회와 같은 NFC 규칙으로 찾는다", async () => {
		const nfc = "한글-초안";
		const nfd = nfc.normalize("NFD");
		expect(nfd).not.toBe(nfc);

		state.entries.set(`post:${nfc}`, draft("post", nfc, { title: "한글", categoryId: "cat-1" }, "본문"));

		const post = await getDraftPreviewPost(nfd);

		expect(state.calls).toEqual([{ collection: "post", slug: nfc, locale: "ko" }]);
		expect(post?.slug).toBe(nfc);
	});

	it("분류가 없는 초안 글은 공개 렌더가 성립하지 않으므로 null이다", async () => {
		state.entries.set("post:no-category", draft("post", "no-category", { title: "분류 없음" }, "본문"));

		await expect(getDraftPreviewPost("no-category")).resolves.toBeNull();
	});

	it("메모 초안은 분류 없이도 만들어진다", async () => {
		state.entries.set(
			"memo:memo-draft",
			draft("memo", "memo-draft", { title: "메모 제목", tagIds: ["tag-1"] }, "메모 본문", {
				tagIds: [relation("tag-1", "ts", "TypeScript", "tag")],
			}),
		);

		await expect(getDraftPreviewMemo("memo-draft")).resolves.toMatchObject({
			status: "draft",
			slug: "memo-draft",
			title: "메모 제목",
			contentMdx: "메모 본문",
			tags: [{ slug: "ts", label: "TypeScript" }],
		});
	});

	it("없는 항목과 빈 slug는 null이다", async () => {
		await expect(getDraftPreviewPost("missing")).resolves.toBeNull();
		await expect(getDraftPreviewMemo("missing")).resolves.toBeNull();
		state.calls = [];
		await expect(getDraftPreviewPost("")).resolves.toBeNull();
		expect(state.calls).toEqual([]);
	});
});
