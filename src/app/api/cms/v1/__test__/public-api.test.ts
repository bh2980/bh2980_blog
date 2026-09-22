import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftPost, PublishedMemo, PublishedPost } from "@/libs/contents/types/contents";

const DRAFT_BODY_SENTINEL = "초안-본문-비밀";

const repo = vi.hoisted(() => {
	const state = {
		posts: [] as unknown[],
		memos: [] as unknown[],
		/** 과거 주소 → 정규 slug. postgres 저장소의 alias 해석 계약을 흉내낸다. */
		aliases: {} as Record<string, string>,
		failure: null as unknown,
	};

	const maybeFail = () => {
		if (state.failure) throw state.failure;
	};

	return {
		state,
		listPosts: async () => {
			maybeFail();
			return state.posts;
		},
		listMemos: async () => {
			maybeFail();
			return state.memos;
		},
		getPost: async (slug: string) => {
			maybeFail();
			const canonical = state.aliases[slug] ?? slug;
			return state.posts.find((post) => (post as { slug: string }).slug === canonical) ?? null;
		},
		getMemo: async (slug: string) => {
			maybeFail();
			return state.memos.find((memo) => (memo as { slug: string }).slug === slug) ?? null;
		},
	};
});

vi.mock("@/libs/contents/get-content-repository", () => ({
	getContentRepository: () => repo,
}));

import { GET as getPublicEntry } from "../public/entries/[collection]/[slug]/route";
import { GET as listPublicEntries } from "../public/entries/route";

const CATEGORY = { slug: "engineering", label: "엔지니어링" };
const TAG = { slug: "typescript", label: "TypeScript" };

function publishedPost(slug: string, overrides: Partial<PublishedPost> = {}): PublishedPost {
	return {
		slug,
		status: "published",
		publishedAt: "2026-03-01T12:00:00.000Z",
		title: `${slug} 제목`,
		excerpt: `${slug} 요약`,
		category: CATEGORY,
		tags: [TAG],
		contentMdx: `${slug} 본문`,
		...overrides,
	};
}

function draftPost(slug: string): DraftPost {
	return {
		slug,
		status: "draft",
		title: `${slug} 초안`,
		excerpt: "",
		category: CATEGORY,
		tags: [],
		contentMdx: DRAFT_BODY_SENTINEL,
	};
}

function publishedMemo(slug: string): PublishedMemo {
	return {
		slug,
		status: "published",
		publishedAt: "2026-03-02T12:00:00.000Z",
		title: `${slug} 메모`,
		tags: [TAG],
		contentMdx: `${slug} 메모 본문`,
	};
}

const request = (path: string) => new NextRequest(new URL(path, "https://example.com"));
const context = (collection: string, slug: string) => ({ params: Promise.resolve({ collection, slug }) });

beforeEach(() => {
	repo.state.posts = [];
	repo.state.memos = [];
	repo.state.aliases = {};
	repo.state.failure = null;
});

describe("M7-BE-3 공개 API 계약", () => {
	it("목록은 공개본만 반환하고 페이지 정보와 no-store를 담는다", async () => {
		repo.state.posts = [publishedPost("a"), draftPost("b")];

		const response = await listPublicEntries(request("/api/cms/v1/public/entries?collection=post"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(body).toMatchObject({ total: 1, page: 1, pageSize: 25 });
		expect(body.items.map((item: { slug: string }) => item.slug)).toEqual(["a"]);
	});

	it("목록 응답에는 초안 본문과 관리자 필드가 직렬화되지 않는다", async () => {
		repo.state.posts = [publishedPost("a"), draftPost("secret")];

		const response = await listPublicEntries(request("/api/cms/v1/public/entries?collection=post"));
		const text = await response.text();

		expect(text).not.toContain(DRAFT_BODY_SENTINEL);
		for (const forbidden of ["version", "folderId", "working", "contentMdx", "status"]) {
			expect(text).not.toContain(forbidden);
		}
		// 목록은 본문을 싣지 않는다(공개본 본문도).
		expect(text).not.toContain("a 본문");
	});

	it("목록은 pageSize만큼 잘라내고 total은 전체 개수다", async () => {
		repo.state.posts = Array.from({ length: 5 }, (_, index) => publishedPost(`post-${index}`));

		const response = await listPublicEntries(request("/api/cms/v1/public/entries?page=2&pageSize=2"));
		const body = await response.json();

		expect(body.total).toBe(5);
		expect(body.page).toBe(2);
		expect(body.pageSize).toBe(2);
		expect(body.items.map((item: { slug: string }) => item.slug)).toEqual(["post-2", "post-3"]);
	});

	it("단건 조회는 본문과 정규 주소를 함께 돌려준다", async () => {
		repo.state.posts = [publishedPost("hello")];

		const response = await getPublicEntry(request("/api/cms/v1/public/entries/post/hello"), context("post", "hello"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.entry.body).toBe("hello 본문");
		expect(body.address).toEqual({ slug: "hello", isAlias: false });
	});

	it("과거 주소로 조회하면 정규 주소와 별칭 표시를 돌려준다", async () => {
		repo.state.posts = [publishedPost("new-slug")];
		repo.state.aliases = { "old-slug": "new-slug" };

		const response = await getPublicEntry(
			request("/api/cms/v1/public/entries/post/old-slug"),
			context("post", "old-slug"),
		);
		const body = await response.json();

		// 저장소가 과거 주소를 정규 slug로 해석해 돌려주는 계약을 그대로 쓴다.
		expect(response.status).toBe(200);
		expect(body.entry.slug).toBe("new-slug");
		expect(body.address).toEqual({ slug: "new-slug", isAlias: true });
		// 응답 어디에도 요청한 과거 주소가 정규 주소로 남지 않는다.
		expect(JSON.stringify(body.entry)).not.toContain("old-slug");
	});

	it("초안 slug와 없는 slug는 404다", async () => {
		repo.state.posts = [publishedPost("hello"), draftPost("draft-slug")];

		const draft = await getPublicEntry(
			request("/api/cms/v1/public/entries/post/draft-slug"),
			context("post", "draft-slug"),
		);
		const missing = await getPublicEntry(request("/api/cms/v1/public/entries/post/nope"), context("post", "nope"));

		expect(draft.status).toBe(404);
		expect(missing.status).toBe(404);
		expect(await draft.text()).not.toContain(DRAFT_BODY_SENTINEL);
	});

	it("메모 컬렉션도 같은 규칙으로 읽는다", async () => {
		repo.state.memos = [publishedMemo("m-1")];

		const list = await listPublicEntries(request("/api/cms/v1/public/entries?collection=memo"));
		const detail = await getPublicEntry(request("/api/cms/v1/public/entries/memo/m-1"), context("memo", "m-1"));

		expect((await list.json()).items[0].collection).toBe("memo");
		expect((await detail.json()).entry.collection).toBe("memo");
	});

	it("지원하지 않는 컬렉션과 잘못된 질의는 400이다", async () => {
		const badCollection = await getPublicEntry(
			request("/api/cms/v1/public/entries/category/engineering"),
			context("category", "engineering"),
		);
		const badQuery = await listPublicEntries(request("/api/cms/v1/public/entries?pageSize=101"));

		expect(badCollection.status).toBe(400);
		expect(badQuery.status).toBe(400);
	});

	it("저장소 장애는 404가 아니라 503이고 내부 메시지를 노출하지 않는다", async () => {
		repo.state.failure = new Error("connect ECONNREFUSED 10.0.0.5:5432");

		const list = await listPublicEntries(request("/api/cms/v1/public/entries"));
		const board = await list.json();

		expect(list.status).toBe(503);
		expect(board.code).toBe("unavailable");
		expect(JSON.stringify(board)).not.toContain("ECONNREFUSED");
		expect(list.status).not.toBe(404);
	});

	it("관리자 세션 없이 동작한다(공개 계약)", async () => {
		repo.state.posts = [publishedPost("hello")];

		// authGateway를 mock하지 않았으므로 인증 코드가 호출되면 이 테스트는 실패한다.
		const response = await listPublicEntries(request("/api/cms/v1/public/entries"));

		expect(response.status).toBe(200);
	});
});
