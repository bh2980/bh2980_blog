import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftMemo, DraftPost, PublishedPost } from "@/libs/contents/types/contents";

/**
 * M9-FE-1: postgres 공개 저장소는 초안을 반환하지 않으므로, 관리자 미리보기가
 * 공개 조회가 비었을 때만 working 본문 경로로 내려가는지 고정한다.
 */
const state = vi.hoisted(() => ({
	granted: true,
	reads: [] as string[],
	post: null as unknown,
	memo: null as unknown,
	draftPost: null as unknown,
	draftMemo: null as unknown,
}));

vi.mock("@/libs/admin/preview-access", () => ({
	canPreview: async () => state.granted,
}));

vi.mock("@/libs/contents/get-content-repository", () => ({
	getContentRepository: () => ({
		getPost: async (slug: string) => {
			state.reads.push(`public:getPost:${slug}`);
			return state.post;
		},
		getMemo: async (slug: string) => {
			state.reads.push(`public:getMemo:${slug}`);
			return state.memo;
		},
		listPosts: async () => [],
		listMemos: async () => [],
		listPostSlugs: async () => [],
		listMemoSlugs: async () => [],
		listCategories: async () => [],
		listTags: async () => [],
		listSeries: async () => [],
		getSeries: async () => null,
	}),
}));

vi.mock("@/libs/contents/repositories/draft-preview", () => ({
	getDraftPreviewPost: async (slug: string) => {
		state.reads.push(`draft:post:${slug}`);
		return state.draftPost;
	},
	getDraftPreviewMemo: async (slug: string) => {
		state.reads.push(`draft:memo:${slug}`);
		return state.draftMemo;
	},
}));

import { getPreviewMemo } from "../memo";
import { getPreviewPost } from "../post";

const draftPost: DraftPost = {
	status: "draft",
	slug: "new-draft",
	title: "새 초안",
	excerpt: "",
	category: { slug: "cat-1", label: "분류" },
	tags: [],
	contentMdx: "편집 중 본문",
};

const draftMemo: DraftMemo = {
	status: "draft",
	slug: "new-memo",
	title: "새 메모 초안",
	tags: [],
	contentMdx: "메모 편집 중",
};

const publishedPost: PublishedPost = {
	status: "published",
	publishedAt: "2026-01-01T00:00:00.000Z",
	slug: "live-post",
	title: "공개 글",
	excerpt: "",
	category: { slug: "cat-1", label: "분류" },
	tags: [],
	contentMdx: "공개 본문",
};

beforeEach(() => {
	state.granted = true;
	state.reads = [];
	state.post = null;
	state.memo = null;
	state.draftPost = draftPost;
	state.draftMemo = draftMemo;
});

describe("M9-FE-1 미리보기 초안 폴백", () => {
	it("공개 조회가 비어 있으면 working 초안 경로로 내려간다", async () => {
		const post = await getPreviewPost("new-draft");

		expect(post?.status).toBe("draft");
		expect(post?.contentMdx).toBe("편집 중 본문");
		expect(state.reads).toEqual(["public:getPost:new-draft", "draft:post:new-draft"]);
	});

	it("메모도 같은 규칙이다", async () => {
		const memo = await getPreviewMemo("new-memo");

		expect(memo?.status).toBe("draft");
		expect(state.reads).toEqual(["public:getMemo:new-memo", "draft:memo:new-memo"]);
	});

	it("공개 조회가 값을 돌려주면 초안 경로를 부르지 않는다", async () => {
		state.post = publishedPost;
		state.memo = publishedPost;

		const post = await getPreviewPost("live-post");
		const memo = await getPreviewMemo("live-post");

		expect(post?.status).toBe("published");
		expect(memo?.status).toBe("published");
		expect(state.reads).toEqual(["public:getPost:live-post", "public:getMemo:live-post"]);
	});

	it("공개도 초안도 없으면 null이다(없는 글은 404)", async () => {
		state.draftPost = null;
		state.draftMemo = null;

		await expect(getPreviewPost("missing")).resolves.toBeNull();
		await expect(getPreviewMemo("missing")).resolves.toBeNull();
	});

	it("세션이 없으면 저장소를 아예 건드리지 않는다", async () => {
		state.granted = false;

		await expect(getPreviewPost("new-draft")).resolves.toBeNull();
		await expect(getPreviewMemo("new-memo")).resolves.toBeNull();

		expect(state.reads).toEqual([]);
	});
});
