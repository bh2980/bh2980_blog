import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftPost, PublishedMemo } from "@/libs/contents/types/contents";

const state = vi.hoisted(() => ({
	granted: false,
	reads: [] as string[],
	writes: [] as string[],
	post: null as unknown,
	posts: [] as unknown[],
	memo: null as unknown,
}));

vi.mock("@/libs/admin/preview-access", () => ({
	canPreview: async () => state.granted,
}));

vi.mock("@/libs/contents/get-content-repository", () => {
	const repository = {
		getPost: async (slug: string) => {
			state.reads.push(`getPost:${slug}`);
			return state.post;
		},
		listPosts: async () => {
			state.reads.push("listPosts");
			return state.posts;
		},
		getMemo: async (slug: string) => {
			state.reads.push(`getMemo:${slug}`);
			return state.memo;
		},
		listMemos: async () => {
			state.reads.push("listMemos");
			return [];
		},
		// 공개 조회 계약에는 쓰기 메서드가 없다. 호출되면 즉시 드러나도록 감시용으로 둔다.
		publishEntry: async () => {
			state.writes.push("publishEntry");
		},
		saveDraft: async () => {
			state.writes.push("saveDraft");
		},
		deleteEntry: async () => {
			state.writes.push("deleteEntry");
		},
	};

	return { getContentRepository: () => repository };
});

import { getPreviewMemo } from "../memo";
import { getPost, getPreviewPost, listPreviewPosts } from "../post";

const DRAFT_BODY = "초안 본문";

function draftPost(): DraftPost {
	return {
		slug: "my-draft",
		status: "draft",
		title: "초안 글",
		excerpt: "요약",
		category: { slug: "engineering", label: "엔지니어링" },
		tags: [],
		contentMdx: DRAFT_BODY,
	};
}

const publishedMemo: PublishedMemo = {
	slug: "memo-1",
	status: "published",
	publishedAt: "2026-03-01T12:00:00.000Z",
	title: "메모",
	tags: [],
	contentMdx: "메모 본문",
};

beforeEach(() => {
	state.granted = false;
	state.reads = [];
	state.writes = [];
	state.post = draftPost();
	state.posts = [draftPost()];
	state.memo = publishedMemo;
});

describe("M7-FE-1 미리보기 서비스 게이트", () => {
	it("세션이 없으면 조회하지 않고 빈 결과를 돌려준다", async () => {
		await expect(getPreviewPost("my-draft")).resolves.toBeNull();
		await expect(getPreviewMemo("memo-1")).resolves.toBeNull();
		await expect(listPreviewPosts()).resolves.toEqual({ list: [], total: 0 });
		// 권한이 없으면 저장소를 아예 건드리지 않는다.
		expect(state.reads).toEqual([]);
	});

	it("세션이 있으면 초안을 그대로 돌려준다", async () => {
		state.granted = true;

		const post = await getPreviewPost("my-draft");

		expect(post?.status).toBe("draft");
		expect(post?.contentMdx).toBe(DRAFT_BODY);
		expect(state.reads).toEqual(["getPost:my-draft"]);
	});

	it("공개 조회는 초안을 숨기지만 미리보기는 노출한다", async () => {
		state.granted = true;

		await expect(getPost("my-draft")).resolves.toBeNull();
		await expect(getPreviewPost("my-draft")).resolves.not.toBeNull();
	});

	it("목록도 세션이 있어야 읽고 전체 개수를 유지한다", async () => {
		state.granted = true;
		state.posts = [draftPost(), { ...draftPost(), slug: "second-draft" }];

		const result = await listPreviewPosts();

		expect(result.total).toBe(2);
		expect(result.list).toHaveLength(2);
	});

	it("미리보기는 어떤 쓰기도 하지 않는다", async () => {
		state.granted = true;

		await getPreviewPost("my-draft");
		await getPreviewMemo("memo-1");
		await listPreviewPosts();

		expect(state.writes).toEqual([]);
	});
});
