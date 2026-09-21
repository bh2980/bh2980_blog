import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ContentStore, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * M7-BE-1 공개 published 읽기 계약 (실DB).
 *
 * 확인 대상(O1 A3/A4/A8): 초안·보관·휴지통·예약 주소는 어떤 경로로도 공개되지 않고,
 * 발행본만 정규 current slug로 조회되며, 과거 주소는 alias로 판정된다.
 */
describe("M7-BE-1 공개 published 읽기 계약", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function createEntry(params: { collection: string; slug: string; metadata?: unknown; mdx?: string }) {
		return store.createEntry({
			collection: params.collection,
			slug: params.slug,
			metadata: params.metadata ?? { title: params.slug },
			mdx: params.mdx ?? `# ${params.slug}`,
			schemaVersion: 1,
			contentHash: `hash-${params.slug}`,
		});
	}

	async function createPublishedEntry(params: { collection: string; slug: string; metadata?: unknown; mdx?: string }) {
		const entry = await createEntry(params);

		return store.publishEntry({ id: entry.id, expectedVersion: entry.version });
	}

	async function publishedSlugs(collections: readonly string[]): Promise<string[]> {
		const rows = await store.listPublishedEntries({ collections });

		return rows.map((row) => row.slug);
	}

	async function addressType(slug: string): Promise<string | undefined> {
		const res = await pool.query<{ type: string }>(
			`SELECT type FROM "${schemaName}".content_addresses WHERE slug = $1`,
			[slug],
		);

		return res.rows[0]?.type;
	}

	it("초안은 공개 목록과 단건 조회에 나오지 않는다", async () => {
		const draft = await createEntry({ collection: "post", slug: "draft-only", metadata: { title: "초안" } });

		expect(draft.status).toBe("draft");
		expect(await addressType("draft-only")).toBe("reservation");
		expect(await publishedSlugs(["post"])).not.toContain("draft-only");
		await expect(store.getPublishedEntryBySlug({ collection: "post", slug: "draft-only" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("발행하면 정규 slug와 본문·metadata가 공개 조회에 나타난다", async () => {
		await createPublishedEntry({
			collection: "post",
			slug: "live-post",
			metadata: { title: "공개 글", summary: "요약" },
			mdx: "# 공개 본문",
		});

		expect(await publishedSlugs(["post"])).toContain("live-post");
		expect(await addressType("live-post")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: "post", slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.slug).toBe("live-post");
			expect(lookup.entry.mdx).toBe("# 공개 본문");
			expect(lookup.entry.metadata).toEqual({ title: "공개 글", summary: "요약" });
			expect(lookup.entry.publishedAt).toBeInstanceOf(Date);
		}
	});

	it("목록 조회는 기본적으로 본문을 싣지 않고 요청할 때만 싣는다", async () => {
		const withoutBody = await store.listPublishedEntries({ collections: ["post"] });
		const withBody = await store.listPublishedEntries({ collections: ["post"], includeBody: true });

		expect(withoutBody.length).toBeGreaterThan(0);
		expect(withoutBody.every((row) => row.mdx === "")).toBe(true);
		expect(withBody.some((row) => row.mdx.length > 0)).toBe(true);
	});

	it("단건 조회는 기본적으로 본문을 싣는다", async () => {
		const lookup = await store.getPublishedEntryBySlug({ collection: "post", slug: "live-post" });

		expect(lookup.status).toBe("current");
		if (lookup.status === "current") {
			expect(lookup.entry.mdx).toBe("# 공개 본문");
		}
	});

	it("보관하면 공개 조회에서 사라진다", async () => {
		const published = await createPublishedEntry({ collection: "post", slug: "to-archive" });

		expect(await publishedSlugs(["post"])).toContain("to-archive");

		await store.archiveEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs(["post"])).not.toContain("to-archive");
		await expect(store.getPublishedEntryBySlug({ collection: "post", slug: "to-archive" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("휴지통으로 보내면 공개 조회에서 사라진다", async () => {
		const published = await createPublishedEntry({ collection: "memo", slug: "to-trash" });

		expect(await publishedSlugs(["memo"])).toContain("to-trash");

		await store.trashEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs(["memo"])).not.toContain("to-trash");
		await expect(store.getPublishedEntryBySlug({ collection: "memo", slug: "to-trash" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("slug를 바꾸면 이전 주소는 alias로 판정되고 정규 slug를 반환한다", async () => {
		const published = await createPublishedEntry({ collection: "post", slug: "before-rename" });
		const saved = await store.saveWorking(published.id, {
			expectedVersion: published.version,
			slug: "after-rename",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-renamed",
		});

		await store.publishEntry({ id: saved.id, expectedVersion: saved.version });

		expect(await addressType("before-rename")).toBe("alias");
		expect(await addressType("after-rename")).toBe("current");

		const lookup = await store.getPublishedEntryBySlug({ collection: "post", slug: "before-rename" });

		expect(lookup.status).toBe("alias");
		if (lookup.status === "alias") {
			expect(lookup.entry.slug).toBe("after-rename");
			expect(lookup.entry.mdx).toBe("# 이름 변경");
		}
	});

	it("비공개로 돌아간 주소는 alias로도 남지 않는다", async () => {
		const published = await createPublishedEntry({ collection: "post", slug: "alias-then-archive" });
		const saved = await store.saveWorking(published.id, {
			expectedVersion: published.version,
			slug: "alias-then-archive-2",
			metadata: { title: "이름 변경" },
			mdx: "# 이름 변경",
			schemaVersion: 1,
			contentHash: "hash-alias-archive",
		});
		const republished = await store.publishEntry({ id: saved.id, expectedVersion: saved.version });

		await store.archiveEntry({ id: republished.id, expectedVersion: republished.version });

		expect(await addressType("alias-then-archive")).toBe("alias");
		await expect(store.getPublishedEntryBySlug({ collection: "post", slug: "alias-then-archive" })).resolves.toEqual({
			status: "not_found",
		});
		await expect(store.getPublishedEntryBySlug({ collection: "post", slug: "alias-then-archive-2" })).resolves.toEqual({
			status: "not_found",
		});
	});

	it("분류 레코드(tag/category)도 공개 조회되고 보관하면 제외된다", async () => {
		const tag = await createPublishedEntry({ collection: "tag", slug: "public-tag", metadata: { title: "공개 태그" } });
		await createPublishedEntry({ collection: "category", slug: "public-category", metadata: { title: "공개 분류" } });

		expect(await publishedSlugs(["tag", "category"])).toEqual(
			expect.arrayContaining(["public-tag", "public-category"]),
		);

		await store.archiveEntry({ id: tag.id, expectedVersion: tag.version });

		expect(await publishedSlugs(["tag"])).not.toContain("public-tag");
		expect(await publishedSlugs(["category"])).toContain("public-category");
	});

	it("여러 컬렉션을 한 번에 읽을 수 있고 발행되지 않은 항목은 섞이지 않는다", async () => {
		await createEntry({ collection: "tag", slug: "draft-tag", metadata: { title: "초안 태그" } });

		const rows = await store.listPublishedEntries({ collections: ["post", "memo", "tag", "category"] });

		expect(rows.every((row) => row.collection !== "secret")).toBe(true);
		expect(rows.map((row) => row.slug)).not.toContain("draft-tag");
	});

	it("허용되지 않은 컬렉션은 거부한다", async () => {
		await expect(store.listPublishedEntries({ collections: ["secret"] })).rejects.toThrow(/컬렉션|collection/);
		await expect(store.listPublishedEntries({ collections: [] })).rejects.toThrow();
		await expect(store.getPublishedEntryBySlug({ collection: "secret", slug: "x" })).rejects.toThrow();
	});

	it("빈 slug는 거부한다", async () => {
		await expect(store.getPublishedEntryBySlug({ collection: "post", slug: "" })).rejects.toThrow();
	});
});
