import { type ContentStore, createContentStore, migrateContentStore } from "@bh2980/cms/runtime";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool, seedEntry } from "@bh2980/cms/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresRepository } from "../postgres";

/**
 * M7-BE-1 / v2 B4: `PostgresRepository`의 공개 매핑. 라이브러리 읽기 API(`@bh2980/cms/read`)가 읽는 실제 DB
 * (`CMS_TEST_DATABASE_URL`의 격리 스키마)를 두고 확인한다. 읽기 API는 컨테이너의 전역 저장소를 쓰므로 그 자리에 시험 저장소를 둔다.
 */
describe("PostgresRepository 공개 매핑 (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let repository: PostgresRepository;
	const ids = new Map<string, string>();

	const snapshot = (
		collection: string,
		slug: string,
		metadata: Record<string, unknown>,
		mdx: string,
		locale?: string,
	) =>
		({
			collection,
			slug,
			metadata,
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${collection}-${slug}-${locale ?? ""}`,
			references: [],
			issues: [],
			imageSources: [],
		}) as never;

	/** 발행까지 한 항목의 ID(번역 묶음 ID). 이름(`key`)으로 나중에 찾는다. */
	async function publish(
		key: string,
		collection: string,
		slug: string,
		metadata: Record<string, unknown>,
		mdx = "본문",
	): Promise<string> {
		const draft = await seedEntry(store, { collection, slug, metadata, mdx });
		await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		ids.set(key, draft.id);
		return draft.id;
	}

	/** 번역본. 언어별 값만 갖고 공통 값(카테고리·태그)은 원문 것을 쓴다. */
	async function publishTranslation(
		sourceKey: string,
		locale: string,
		slug: string,
		metadata: Record<string, unknown>,
		mdx = "본문",
	) {
		const sourceId = ids.get(sourceKey) as string;
		const source = await store.getEntry(sourceId);
		const draft = await store.createEntryWithReferences({
			snapshot: snapshot(source.collection, slug, metadata, mdx, locale),
			references: [],
			locale,
			translationOf: sourceId,
		});
		await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	}

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		(globalThis as { __cmsStore?: ContentStore }).__cmsStore = store;
		repository = new PostgresRepository();

		await publish("cat-eng", "category", "engineering", {
			title: "엔지니어링",
			translations: { en: { title: "Engineering" } },
		});
		await publish("cat-notes", "category", "notes", { title: "기록" });
		await publish("tag-ts", "tag", "typescript", { title: "TypeScript" });
		await publish("tag-react", "tag", "react", { title: "React" });

		await publish(
			"first",
			"post",
			"first-post",
			{
				title: "첫 글",
				summary: "요약 1",
				categoryId: ids.get("cat-eng"),
				tagIds: [ids.get("tag-ts"), ids.get("tag-react")],
				policy: "evergreen",
			},
			"# 본문 1",
		);
		await publishTranslation("first", "en", "first-post-en", { title: "First post", summary: "Summary" });
		await publish("second", "post", "second-post", {
			title: "둘째 글",
			categoryId: ids.get("cat-notes"),
			tagIds: [ids.get("tag-react")],
		});
		await publish("old", "post", "old-post", {
			title: "옛 글",
			categoryId: ids.get("cat-eng"),
			policy: "deprecated",
			replacementPostId: ids.get("first"),
		});
		await publish("old-orphan", "post", "old-orphan-post", {
			title: "대체 글 없음",
			categoryId: ids.get("cat-eng"),
			policy: "deprecated",
		});
		await publish("seo", "post", "seo-post", {
			title: "SEO 글",
			categoryId: ids.get("cat-eng"),
			seoTitle: "검색 제목",
			seoDescription: "검색 설명",
			canonicalUrl: "https://dev.to/crosspost",
		});
		await publish("bad-canonical", "post", "bad-canonical-post", {
			title: "글",
			categoryId: ids.get("cat-eng"),
			seoTitle: "제목",
			canonicalUrl: "javascript:alert(1)",
		});
		await publish("hangul", "post", "한글-슬러그", { title: "한글 글", categoryId: ids.get("cat-eng") });

		await publish("memo-a", "memo", "memo-a", { title: "메모 A", tagIds: [ids.get("tag-react")] });
		await publish("memo-b", "memo", "memo-b", { title: "메모 B" });
		await publish("memo-seo", "memo", "seo-memo", {
			title: "SEO 메모",
			seoTitle: "메모 제목",
			canonicalUrl: "/memos/canonical",
		});
		await publish("memo-hangul", "memo", "메모-슬러그", { title: "한글 메모" });

		await publish("series", "collection", "type-challenges", {
			title: "타입 챌린지",
			summary: "연재 설명",
			itemKind: "post",
			itemIds: [ids.get("second"), ids.get("first")],
			translations: { en: { title: "Series" } },
		});
	});

	afterAll(async () => {
		delete (globalThis as { __cmsStore?: ContentStore }).__cmsStore;
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("게시글을 카테고리·태그·요약·evergreen 여부와 함께 매핑한다", async () => {
		const post = await repository.getPost("first-post");

		expect(post).toEqual({
			slug: "first-post",
			locale: "ko",
			translationGroupId: ids.get("first"),
			status: "published",
			title: "첫 글",
			excerpt: "요약 1",
			category: { slug: "engineering", label: "엔지니어링" },
			tags: [
				{ slug: "typescript", label: "TypeScript" },
				{ slug: "react", label: "React" },
			],
			contentMdx: "# 본문 1",
			publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			isEvergreen: true,
		});
	});

	it("발행일은 DB가 처음 발행할 때 기록한 칸이다", async () => {
		const memo = await repository.getMemo("memo-a");
		const row = await pool.query<{ published_at: Date }>(
			`SELECT published_at FROM "${schemaName}".entries WHERE id = $1`,
			[ids.get("memo-a")],
		);

		expect(memo?.status === "published" && memo.publishedAt).toBe(row.rows[0]?.published_at.toISOString());
	});

	it("목록 조회 결과의 본문은 빈 문자열이고 상세 조회에서만 본문을 싣는다", async () => {
		const [list, detail] = await Promise.all([repository.listPosts(), repository.getPost("first-post")]);

		expect(list.length).toBeGreaterThan(0);
		expect(list.every((post) => post.contentMdx === "")).toBe(true);
		expect(detail?.contentMdx).toBe("# 본문 1");
	});

	it("listPosts가 카테고리·태그 슬러그로 DB에서 거른다", async () => {
		const byCategory = await repository.listPosts({ category: "notes" });
		const byTag = await repository.listPosts({ tag: "react" });
		const both = await repository.listPosts({ category: "engineering", tag: "react" });

		expect(byCategory.map((post) => post.slug)).toEqual(["second-post"]);
		expect(byTag.map((post) => post.slug).sort()).toEqual(["first-post", "second-post"]);
		expect(both.map((post) => post.slug)).toEqual(["first-post"]);
		await expect(repository.listPosts({ category: "no-such-category" })).resolves.toEqual([]);
		await expect(repository.listPosts({ tag: "no-such-tag" })).resolves.toEqual([]);
	});

	it("status가 all이어도 초안을 만들지 않는다(공개본만 반환)", async () => {
		await seedEntry(store, {
			collection: "post",
			slug: "only-draft",
			metadata: { title: "초안", categoryId: ids.get("cat-eng") },
			mdx: "초안 본문",
		});

		const all = await repository.listPosts({ status: "all" });

		expect(all.every((post) => post.status === "published")).toBe(true);
		expect(all.map((post) => post.slug)).not.toContain("only-draft");
	});

	it("메모를 태그와 함께 매핑하고 태그로 필터한다", async () => {
		const memo = await repository.getMemo("memo-a");
		const filtered = await repository.listMemos({ tag: "react" });

		expect(memo).toEqual({
			slug: "memo-a",
			locale: "ko",
			translationGroupId: ids.get("memo-a"),
			status: "published",
			title: "메모 A",
			tags: [{ slug: "react", label: "React" }],
			contentMdx: "본문",
			publishedAt: expect.any(String),
			updatedAt: expect.any(String),
		});
		expect(filtered.map((item) => item.slug)).toEqual(["memo-a"]);
		await expect(repository.listMemos({ tag: "no-such-tag" })).resolves.toEqual([]);
	});

	it("모음집이 itemIds 순서를 보존하고 설명을 담는다", async () => {
		const series = await repository.getSeries("type-challenges");

		expect(series?.label).toBe("타입 챌린지");
		expect(series?.description).toBe("연재 설명");
		expect(series?.items.map((item) => item.slug)).toEqual(["second-post", "first-post"]);
		expect((await repository.listSeries()).map((item) => item.slug)).toEqual(["type-challenges"]);
		await expect(repository.getSeries("no-such-series")).resolves.toBeNull();
	});

	it("공개 슬러그와 분류 목록을 반환한다", async () => {
		await expect(repository.listPostSlugs()).resolves.toEqual(expect.arrayContaining(["first-post", "second-post"]));
		expect((await repository.listPostSlugs()).sort()).not.toContain("first-post-en");
		await expect(repository.listMemoSlugs()).resolves.toEqual(
			expect.arrayContaining(["memo-a", "memo-b", "seo-memo", "메모-슬러그"]),
		);
		expect((await repository.listTags()).map((tag) => [tag.slug, tag.label]).sort()).toEqual([
			["react", "React"],
			["typescript", "TypeScript"],
		]);
		expect((await repository.listCategories()).map((category) => [category.slug, category.label]).sort()).toEqual([
			["engineering", "엔지니어링"],
			["notes", "기록"],
		]);
	});

	it("저장소 오류를 404로 바꾸지 않고 그대로 전파한다", async () => {
		const original = (globalThis as { __cmsStore?: ContentStore }).__cmsStore;
		(globalThis as { __cmsStore?: ContentStore }).__cmsStore = {
			getPublishedEntryBySlug: async () => {
				throw new Error("connection refused");
			},
			listPublishedPage: async () => {
				throw new Error("connection refused");
			},
		} as unknown as ContentStore;
		try {
			await expect(repository.listPosts()).rejects.toThrow("connection refused");
			await expect(repository.getPost("first-post")).rejects.toThrow("connection refused");
		} finally {
			(globalThis as { __cmsStore?: ContentStore }).__cmsStore = original;
		}
	});

	it("SEO metadata를 공개 seo 객체로 옮긴다", async () => {
		expect((await repository.getPost("seo-post"))?.seo).toEqual({
			title: "검색 제목",
			description: "검색 설명",
			canonicalUrl: "https://dev.to/crosspost",
		});
		expect((await repository.getMemo("seo-memo"))?.seo).toEqual({
			title: "메모 제목",
			canonicalUrl: "/memos/canonical",
		});
	});

	it("SEO를 입력하지 않은 글에는 seo 키가 생기지 않는다", async () => {
		const post = await repository.getPost("first-post");

		expect(post).not.toBeNull();
		expect(Object.hasOwn(post as object, "seo")).toBe(false);
	});

	it("위험한 canonical은 버리고 나머지 SEO 값은 남긴다", async () => {
		expect((await repository.getPost("bad-canonical-post"))?.seo).toEqual({ title: "제목" });
	});

	it("NFD로 들어온 한글 주소도 NFC로 정규화해 조회한다", async () => {
		const post = await repository.getPost("한글-슬러그".normalize("NFD"));
		const memo = await repository.getMemo("메모-슬러그".normalize("NFD"));

		expect(post?.slug).toBe("한글-슬러그");
		expect(memo?.slug).toBe("메모-슬러그");
	});

	it("정규화로 찾지 못하면 404로 끝나고 예외를 던지지 않는다", async () => {
		await expect(repository.getPost("없는-글".normalize("NFD"))).resolves.toBeNull();
		// 잘못된 퍼센트 인코딩도 500이 아니라 조회 실패로 다룬다.
		await expect(repository.getPost("100%-확실해")).resolves.toBeNull();
		await expect(repository.getPost("")).resolves.toBeNull();
	});

	it("지원 중단 글은 공개된 대체 글로 안내하고, 대체 글이 없으면 null이다", async () => {
		expect((await repository.getPost("old-post"))?.deprecation).toEqual({
			replacement: { slug: "first-post", title: "첫 글", locale: "ko" },
		});
		expect((await repository.getPost("old-orphan-post"))?.deprecation).toEqual({ replacement: null });
		expect((await repository.getPost("first-post"))?.deprecation).toBeUndefined();
	});
});

describe("v2 B4 언어별 공개 조회 (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let repository: PostgresRepository;
	const ids = new Map<string, string>();

	const snapshot = (collection: string, slug: string, metadata: Record<string, unknown>) =>
		({
			collection,
			slug,
			metadata,
			mdx: "본문",
			schemaVersion: 1,
			contentHash: `hash-${collection}-${slug}`,
			references: [],
			issues: [],
			imageSources: [],
		}) as never;

	async function publish(key: string, collection: string, slug: string, metadata: Record<string, unknown>) {
		const draft = await seedEntry(store, { collection, slug, metadata, mdx: "본문" });
		await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		ids.set(key, draft.id);
	}

	async function publishTranslation(
		sourceKey: string,
		collection: string,
		locale: string,
		slug: string,
		metadata: Record<string, unknown>,
	) {
		const draft = await store.createEntryWithReferences({
			snapshot: snapshot(collection, slug, metadata),
			references: [],
			locale,
			translationOf: ids.get(sourceKey) as string,
		});
		await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	}

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		(globalThis as { __cmsStore?: ContentStore }).__cmsStore = store;
		repository = new PostgresRepository();

		await publish("cat-eng", "category", "engineering", {
			title: "엔지니어링",
			translations: { en: { title: "Engineering" } },
		});
		await publish("cat-notes", "category", "notes", { title: "기록" });
		await publish("tag-ts", "tag", "typescript", { title: "TypeScript" });
		await publish("first", "post", "first-post", {
			title: "첫 글",
			categoryId: ids.get("cat-eng"),
			tagIds: [ids.get("tag-ts")],
		});
		await publishTranslation("first", "post", "en", "first-post-en", { title: "First post", summary: "Summary" });
		await publish("second", "post", "second-post", { title: "둘째 글", categoryId: ids.get("cat-notes") });
		await publish("old", "post", "old-post", {
			title: "옛 글",
			categoryId: ids.get("cat-eng"),
			policy: "deprecated",
			replacementPostId: ids.get("first"),
		});
		await publishTranslation("old", "post", "en", "old-post-en", { title: "Old post" });
		await publish("memo", "memo", "memo-a", { title: "메모" });
		await publish("series", "collection", "series", {
			title: "연재",
			summary: "연재 설명",
			itemKind: "post",
			itemIds: [ids.get("second"), ids.get("first")],
			translations: { en: { title: "Series" } },
		});
	});

	afterAll(async () => {
		delete (globalThis as { __cmsStore?: ContentStore }).__cmsStore;
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("그 언어 번역본만 목록에 보이고 분류 이름은 언어별 값(없으면 기본 언어)을 쓴다", async () => {
		const posts = await repository.listPosts({}, "en");

		expect(posts.map((post) => [post.slug, post.title, post.locale]).sort()).toEqual([
			["first-post-en", "First post", "en"],
			["old-post-en", "Old post", "en"],
		]);
		const first = posts.find((post) => post.slug === "first-post-en");
		expect(first?.category).toEqual({ slug: "engineering", label: "Engineering" });
		expect(first?.tags).toEqual([{ slug: "typescript", label: "TypeScript" }]);
		await expect(repository.listPosts({}, "ja")).resolves.toEqual([]);
		expect((await repository.listCategories("en")).find((item) => item.slug === "notes")?.label).toBe("기록");
		expect((await repository.listCategories("en")).find((item) => item.slug === "engineering")?.label).toBe(
			"Engineering",
		);
		// 분류 필터는 주소로 건다. 번역본의 공통 값(카테고리)은 원문에서 읽는다.
		expect((await repository.listPosts({ category: "engineering" }, "en")).map((post) => post.slug).sort()).toEqual([
			"first-post-en",
			"old-post-en",
		]);
	});

	it("번역본이 없는 언어의 주소는 찾지 않는다", async () => {
		await expect(repository.getPost("second-post", "en")).resolves.toBeNull();
		expect((await repository.getPost("first-post-en", "en"))?.title).toBe("First post");
		await expect(repository.getPost("first-post-en")).resolves.toBeNull();
	});

	it("지원 중단 글의 대체 글은 같은 언어 번역본이 있으면 그 글로, 없으면 원문으로 안내한다", async () => {
		expect((await repository.getPost("old-post-en", "en"))?.deprecation).toEqual({
			replacement: { slug: "first-post-en", title: "First post", locale: "en" },
		});
		await publish("second-old", "post", "second-old-post", {
			title: "또 다른 옛 글",
			categoryId: ids.get("cat-eng"),
			policy: "deprecated",
			replacementPostId: ids.get("second"),
		});
		await publishTranslation("second-old", "post", "en", "second-old-post-en", { title: "Another old post" });
		expect((await repository.getPost("second-old-post-en", "en"))?.deprecation).toEqual({
			replacement: { slug: "second-post", title: "둘째 글", locale: "ko" },
		});
	});

	it("모음집은 그 언어 번역본이 공개된 글만 담는다", async () => {
		const series = await repository.getSeries("series", "en");

		expect(series?.label).toBe("Series");
		expect(series?.description).toBe("연재 설명");
		expect(series?.items.map((item) => item.title)).toEqual(["First post"]);
		expect((await repository.getSeries("series"))?.items.map((item) => item.slug)).toEqual([
			"second-post",
			"first-post",
		]);
	});

	it("묶음의 공개 언어와 본문 링크 표를 준다", async () => {
		const group = ids.get("first") as string;

		await expect(repository.listTranslations("post", group)).resolves.toEqual([
			{ locale: "ko", slug: "first-post" },
			{ locale: "en", slug: "first-post-en" },
		]);
		await expect(repository.listTranslations("post", ids.get("second") as string)).resolves.toEqual([
			{ locale: "ko", slug: "second-post" },
		]);
		const addresses = await repository.listLocalizedAddresses("en");
		expect([...addresses].sort()).toEqual([
			["post:first-post", "first-post-en"],
			["post:old-post", "old-post-en"],
			["post:second-old-post", "second-old-post-en"],
		]);
		expect((await repository.listLocalizedAddresses("ko")).size).toBe(0);
		expect((await repository.listLocalizedAddresses("ja")).size).toBe(0);
	});
});
