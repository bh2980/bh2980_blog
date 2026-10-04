import { type ContentStore, createContentStore, migrateContentStore } from "@monti-cms/core/runtime";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	seedEntry,
	seedSave,
} from "@monti-cms/core/testing";
import { NextRequest } from "next/server";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "../../[...path]/route";

/**
 * M7-BE-3 공개 API 계약. 이 블로그는 공개 JSON API를 라이브러리 본체(서버 설정 `cms.server.ts`의 `publicApi`)로 켜므로,
 * 앱의 `[...path]` 라우트를 그대로 부르고 `CMS_TEST_DATABASE_URL`의 격리 스키마를 읽는다(관리자 세션은 두지 않는다).
 */
const DRAFT_BODY_SENTINEL = "초안-본문-비밀";

const globalStore = globalThis as { __cmsStore?: ContentStore };

describe("M7-BE-3 공개 API 계약 (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	const ids = new Map<string, string>();

	const get = async (path: string) => {
		const [pathname = "", query = ""] = path.split("?");
		const response = await GET(
			new NextRequest(new URL(`/api/cms/${pathname}${query ? `?${query}` : ""}`, "https://example.com")),
			{ params: Promise.resolve({ path: pathname.split("/") }) },
		);
		const text = await response.text();
		return { status: response.status, cache: response.headers.get("cache-control"), text, body: JSON.parse(text) };
	};

	async function publish(
		key: string,
		collection: string,
		slug: string,
		metadata: Record<string, unknown>,
		mdx = `${slug} 본문`,
	) {
		const draft = await seedEntry(store, { collection, slug, metadata, mdx });
		const published = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		ids.set(key, draft.id);
		return published;
	}

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		globalStore.__cmsStore = store;

		await publish("category", "category", "engineering", { title: "엔지니어링" });
		await publish("category-notes", "category", "notes", { title: "기록" });
		await publish("tag", "tag", "typescript", { title: "TypeScript" });
		await publish(
			"a",
			"post",
			"a",
			{
				title: "a 제목",
				summary: "a 요약",
				categoryId: ids.get("category"),
				tagIds: [ids.get("tag")],
				policy: "evergreen",
				seoTitle: "검색 제목",
			},
			"a 본문",
		);
		await publish("b", "post", "b", { title: "b 제목", categoryId: ids.get("category-notes") });
		await seedEntry(store, {
			collection: "post",
			slug: "draft-slug",
			metadata: { title: "초안", categoryId: ids.get("category") },
			mdx: DRAFT_BODY_SENTINEL,
		});
		const archived = await publish("archived", "post", "archived-slug", {
			title: "보관",
			categoryId: ids.get("category"),
		});
		await store.archiveEntry({ id: archived.id, expectedVersion: archived.version });
		const trashed = await publish("trashed", "post", "trashed-slug", {
			title: "휴지통",
			categoryId: ids.get("category"),
		});
		await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });

		const renamed = await publish(
			"old",
			"post",
			"old-slug",
			{ title: "옛 주소", categoryId: ids.get("category") },
			"옛 주소 본문",
		);
		const saved = await seedSave(store, renamed.id, {
			expectedVersion: renamed.version,
			slug: "new-slug",
			metadata: renamed.working.metadata,
			mdx: renamed.working.mdx,
		});
		await store.publishEntry({ id: renamed.id, expectedVersion: saved.version });

		await publish("memo", "memo", "m-1", { title: "m-1 메모", tagIds: [ids.get("tag")] }, "m-1 메모 본문");
	});

	afterAll(async () => {
		delete globalStore.__cmsStore;
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("목록은 공개본만 반환하고 페이지 정보와 no-store를 담는다", async () => {
		const response = await get("v1/public/entries?collection=post");

		expect(response.status).toBe(200);
		expect(response.cache).toBe("no-store");
		expect(response.body).toMatchObject({ total: 3, page: 1, pageSize: 25 });
		expect(response.body.items.map((item: { slug: string }) => item.slug).sort()).toEqual(["a", "b", "new-slug"]);
	});

	it("collection을 주지 않으면 게시글 목록이다", async () => {
		const response = await get("v1/public/entries");

		expect(response.body.items.every((item: { collection: string }) => item.collection === "post")).toBe(true);
	});

	it("목록 항목은 예전 공개 DTO 모양 그대로다", async () => {
		const response = await get("v1/public/entries?collection=post&category=engineering&tag=typescript");

		expect(response.body.items).toEqual([
			{
				collection: "post",
				slug: "a",
				title: "a 제목",
				publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
				tags: [{ slug: "typescript", label: "TypeScript" }],
				seo: { title: "검색 제목" },
				excerpt: "a 요약",
				category: { slug: "engineering", label: "엔지니어링" },
				isEvergreen: true,
			},
		]);
	});

	it("목록 응답에는 초안 본문과 관리자 필드가 직렬화되지 않는다", async () => {
		const response = await get("v1/public/entries?collection=post");

		expect(response.text).not.toContain(DRAFT_BODY_SENTINEL);
		for (const forbidden of ["version", "folderId", "working", "contentMdx", "status", "metadata", "relations"]) {
			expect(response.text).not.toContain(forbidden);
		}
		// 목록은 본문을 싣지 않는다(공개본 본문도).
		expect(response.text).not.toContain("a 본문");
	});

	it("카테고리·태그는 주소로 거르고 없는 주소는 빈 목록이다", async () => {
		const byCategory = await get("v1/public/entries?category=notes");
		const byTag = await get("v1/public/entries?collection=memo&tag=typescript");
		const missing = await get("v1/public/entries?category=no-such-category");

		expect(byCategory.body.items.map((item: { slug: string }) => item.slug)).toEqual(["b"]);
		expect(byTag.body.items.map((item: { slug: string }) => item.slug)).toEqual(["m-1"]);
		expect(missing.body).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
		expect((await get("v1/public/entries?tag=")).status).toBe(400);
	});

	it("목록은 pageSize만큼 잘라내고 total은 전체 개수다", async () => {
		const first = await get("v1/public/entries?page=1&pageSize=2");
		const second = await get("v1/public/entries?page=2&pageSize=2");

		expect(first.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
		expect(first.body.items).toHaveLength(2);
		expect(second.body.items).toHaveLength(1);
		const slugs = [...first.body.items, ...second.body.items].map((item: { slug: string }) => item.slug);
		expect(new Set(slugs).size).toBe(3);
	});

	it("단건 조회는 본문과 정규 주소를 함께 돌려준다", async () => {
		const response = await get("v1/public/entries/post/a");

		expect(response.status).toBe(200);
		expect(response.body.entry.body).toBe("a 본문");
		expect(response.body.entry).toMatchObject({ collection: "post", slug: "a", title: "a 제목" });
		expect(response.body.address).toEqual({ slug: "a", isAlias: false });
	});

	it("과거 주소로 조회하면 정규 주소와 별칭 표시를 돌려준다", async () => {
		const response = await get("v1/public/entries/post/old-slug");

		expect(response.status).toBe(200);
		expect(response.body.entry.slug).toBe("new-slug");
		expect(response.body.address).toEqual({ slug: "new-slug", isAlias: true });
		// 응답 어디에도 요청한 과거 주소가 정규 주소로 남지 않는다.
		expect(JSON.stringify(response.body.entry)).not.toContain("old-slug");
	});

	it("초안·보관·휴지통 slug와 없는 slug는 404다", async () => {
		for (const slug of ["draft-slug", "archived-slug", "trashed-slug", "nope"]) {
			const response = await get(`v1/public/entries/post/${slug}`);

			expect(response.status).toBe(404);
			expect(response.cache).toBe("no-store");
			expect(response.text).not.toContain(DRAFT_BODY_SENTINEL);
		}
	});

	it("메모 컬렉션도 같은 규칙으로 읽고 카테고리·요약은 싣지 않는다", async () => {
		const list = await get("v1/public/entries?collection=memo");
		const detail = await get("v1/public/entries/memo/m-1");

		expect(list.body.items[0]).toMatchObject({ collection: "memo", slug: "m-1" });
		expect(list.body.items[0]).not.toHaveProperty("category");
		expect(list.body.items[0]).not.toHaveProperty("excerpt");
		expect(detail.body.entry).toMatchObject({ collection: "memo", body: "m-1 메모 본문" });
	});

	it("지원하지 않는 컬렉션과 잘못된 질의는 400이다", async () => {
		const badCollection = await get("v1/public/entries/category/engineering");
		const badListCollection = await get("v1/public/entries?collection=category");
		const badSize = await get("v1/public/entries?pageSize=101");
		const badPage = await get("v1/public/entries?page=0");

		for (const response of [badCollection, badListCollection, badSize, badPage]) {
			expect(response.status).toBe(400);
			expect(response.cache).toBe("no-store");
		}
	});

	it("저장소 장애는 404가 아니라 503이고 내부 메시지를 노출하지 않는다", async () => {
		globalStore.__cmsStore = {
			listPublishedPage: async () => {
				throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
			},
		} as unknown as ContentStore;
		const originalError = console.error;
		console.error = () => {};
		try {
			const list = await get("v1/public/entries");

			expect(list.status).toBe(503);
			expect(list.cache).toBe("no-store");
			expect(list.body.code).toBe("unavailable");
			expect(list.text).not.toContain("ECONNREFUSED");
		} finally {
			console.error = originalError;
			globalStore.__cmsStore = store;
		}
	});
});
