import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "@/cms/adapters/postgres/__test__/test-database";
import { type ContentStore, createContentStore, migrateContentStore } from "@/cms/adapters/postgres/content-store";
import { PostgresRepository } from "../postgres";

/**
 * M7-BE-2 통합 검증: 실제 DB → `PostgresRepository` → 공개 조회.
 *
 * `postgres-repository.test.ts`는 fake store를 쓰므로 실제 SQL·주소 판정은 여기서 확인한다.
 * 페이지가 기대하는 계약: 발행하면 다음 요청에 노출, 보관·휴지통이면 제외(404),
 * 주소를 바꾸면 이전 주소 조회가 정규 slug를 반환(페이지가 308 판정), SEO는 도메인 값으로 전달.
 *
 * 주의: 글은 **해석 가능한 published 카테고리**가 있어야 공개된다(`toPost`가 없으면 null).
 * 이관 시 카테고리 레코드가 published로 들어와야 한다는 뜻이라 테스트로 고정한다.
 */
describe("M7-BE-2 공개 repository 통합 계약 (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let repository: PostgresRepository;
	let categoryId: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		repository = new PostgresRepository(() => store);

		const category = await store.createEntry({
			collection: "category",
			slug: "engineering",
			metadata: { title: "엔지니어링" },
			mdx: "",
			schemaVersion: 1,
			contentHash: "hash-category",
		});
		const publishedCategory = await store.publishEntry({ id: category.id, expectedVersion: category.version });

		categoryId = publishedCategory.id;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function publish(params: {
		collection: "post" | "memo";
		slug: string;
		metadata?: Record<string, unknown>;
		mdx?: string;
	}) {
		const metadata =
			params.metadata ?? (params.collection === "post" ? { title: params.slug, categoryId } : { title: params.slug });
		const entry = await store.createEntry({
			collection: params.collection,
			slug: params.slug,
			metadata,
			mdx: params.mdx ?? `# ${params.slug}`,
			schemaVersion: 1,
			contentHash: `hash-${params.slug}`,
		});

		return store.publishEntry({ id: entry.id, expectedVersion: entry.version });
	}

	async function draft(params: { collection: "post" | "memo"; slug: string }) {
		return store.createEntry({
			collection: params.collection,
			slug: params.slug,
			metadata: { title: "초안", categoryId },
			mdx: "# 초안 본문",
			schemaVersion: 1,
			contentHash: `hash-${params.slug}`,
		});
	}

	async function publishedSlugs(): Promise<string[]> {
		const posts = await repository.listPosts({ status: "published" });

		return posts.map((post) => post.slug);
	}

	it("발행하면 목록과 단건 조회에 바로 나타난다", async () => {
		await publish({
			collection: "post",
			slug: "live-1",
			metadata: { title: "공개 글", summary: "요약", categoryId },
			mdx: "# 공개 본문",
		});

		const post = await repository.getPost("live-1");

		expect(await publishedSlugs()).toContain("live-1");
		expect(post?.title).toBe("공개 글");
		expect(post?.contentMdx).toBe("# 공개 본문");
		expect(post?.status).toBe("published");
		expect(post?.category.slug).toBe("engineering");
	});

	it("초안은 목록과 단건 조회 어디에도 없다", async () => {
		await draft({ collection: "post", slug: "draft-1" });

		expect(await publishedSlugs()).not.toContain("draft-1");
		expect(await repository.getPost("draft-1")).toBeNull();
	});

	it("보관하면 목록에서 빠지고 단건은 null이다(페이지 404)", async () => {
		const published = await publish({ collection: "post", slug: "archive-me" });

		expect(await repository.getPost("archive-me")).not.toBeNull();

		await store.archiveEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs()).not.toContain("archive-me");
		expect(await repository.getPost("archive-me")).toBeNull();
	});

	it("휴지통으로 보내도 같다", async () => {
		const published = await publish({ collection: "post", slug: "trash-me" });

		await store.trashEntry({ id: published.id, expectedVersion: published.version });

		expect(await publishedSlugs()).not.toContain("trash-me");
		expect(await repository.getPost("trash-me")).toBeNull();
	});

	it("주소를 바꾸면 이전 주소 조회가 정규 slug를 반환한다(페이지 308 판정)", async () => {
		const published = await publish({ collection: "post", slug: "old-addr" });
		const saved = await store.saveWorking(published.id, {
			expectedVersion: published.version,
			slug: "new-addr",
			metadata: { title: "새 주소", categoryId },
			mdx: "# 새 주소",
			schemaVersion: 1,
			contentHash: "hash-new-addr",
		});

		await store.publishEntry({ id: saved.id, expectedVersion: saved.version });

		const viaOld = await repository.getPost("old-addr");

		// 페이지는 `post.slug !== 요청 slug`로 308을 낸다.
		expect(viaOld?.slug).toBe("new-addr");
		expect(viaOld?.title).toBe("새 주소");
		expect((await repository.getPost("new-addr"))?.slug).toBe("new-addr");
		expect(await publishedSlugs()).not.toContain("old-addr");
		expect(await publishedSlugs()).toContain("new-addr");
	});

	it("해석 가능한 published 카테고리가 없으면 공개되지 않는다", async () => {
		await publish({ collection: "post", slug: "no-category", metadata: { title: "카테고리 없음" } });

		expect(await publishedSlugs()).not.toContain("no-category");
		expect(await repository.getPost("no-category")).toBeNull();
	});

	it("메모도 같은 규칙을 따른다", async () => {
		await publish({ collection: "memo", slug: "memo-1", metadata: { title: "메모" }, mdx: "# 메모 본문" });

		const memos = await repository.listMemos({ status: "published" });
		const memo = await repository.getMemo("memo-1");

		expect(memos.map((item) => item.slug)).toContain("memo-1");
		expect(memo?.contentMdx).toBe("# 메모 본문");
		expect(await repository.getMemo("post-slug-not-memo")).toBeNull();
	});

	it("SEO metadata가 도메인 값으로 전달되고 없으면 seo 키를 만들지 않는다", async () => {
		await publish({
			collection: "post",
			slug: "seo-1",
			metadata: {
				title: "SEO 글",
				categoryId,
				seoTitle: "검색 제목",
				seoDescription: "검색 설명",
				canonicalUrl: "https://dev.to/crosspost",
			},
		});
		await publish({ collection: "post", slug: "seo-none", metadata: { title: "SEO 없음", categoryId } });

		const withSeo = await repository.getPost("seo-1");
		const withoutSeo = await repository.getPost("seo-none");

		expect(withSeo?.seo).toEqual({
			title: "검색 제목",
			description: "검색 설명",
			canonicalUrl: "https://dev.to/crosspost",
		});
		expect(withoutSeo?.seo).toBeUndefined();
		expect("seo" in (withoutSeo ?? {})).toBe(false);
	});

	it("목록 조회는 본문을 싣지 않는다", async () => {
		const posts = await repository.listPosts({ status: "published" });
		const withBody = posts.filter((post) => post.contentMdx.length > 0);

		expect(posts.length).toBeGreaterThan(0);
		expect(withBody).toEqual([]);
	});
});
