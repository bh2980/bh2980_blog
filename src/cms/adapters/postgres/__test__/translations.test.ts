import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** v2 B4 다국어: 언어별 문서 + 번역 묶음. */
describe("번역 묶음(v2 B4)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	const createCategory = async (title = "에세이") =>
		service.createDraft({ collection: "category", slug: `category-${++sequence}`, metadata: { title }, mdx: "" });

	const createPost = async (slug: string) => {
		const category = await createCategory();
		return service.createDraft({
			collection: "post",
			slug,
			metadata: {
				title: "한국어 제목",
				summary: "한국어 요약",
				categoryId: category.id,
				policy: "evergreen",
				seoTitle: "검색 제목",
			},
			mdx: "한국어 본문",
		});
	};

	const publish = (entry: Entry) => store.publishEntry({ id: entry.id, expectedVersion: entry.version });

	it("다시 이전해도 결과가 같다(열·기본 키)", async () => {
		await migrateContentStore(pool, { schema: schemaName });
		const pk = await pool.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.key_column_usage
			 WHERE table_schema = $1 AND constraint_name = 'content_addresses_pkey' ORDER BY ordinal_position`,
			[schemaName],
		);
		expect(pk.rows.map((row) => row.column_name)).toEqual(["collection", "locale", "slug"]);
	});

	it("번역본은 원문의 언어별 값·본문·주소를 복사하고 공통 값은 가지지 않는다", async () => {
		const source = await createPost("copy-source");
		expect(source.locale).toBe("ko");
		expect(source.translationGroupId).toBe(source.id);

		const translation = await service.createTranslation({ sourceId: source.id, locale: "en" });
		expect(translation.locale).toBe("en");
		expect(translation.translationGroupId).toBe(source.id);
		expect(translation.status).toBe("draft");
		expect(translation.workingSlug).toBe("copy-source");
		expect(translation.working.mdx).toBe("한국어 본문");
		expect(translation.working.metadata).toEqual({
			title: "한국어 제목",
			summary: "한국어 요약",
			seoTitle: "검색 제목",
		});

		const group = await store.getTranslationGroup({ entryId: translation.id });
		expect(group.groupId).toBe(source.id);
		expect(group.members.map((member) => [member.locale, member.isSource])).toEqual([
			["ko", true],
			["en", false],
		]);
	});

	it("같은 언어 번역본은 하나뿐이고, 번역본의 번역본은 원문에서 만든다", async () => {
		const source = await createPost("unique-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		await expect(service.createTranslation({ sourceId: source.id, locale: "en" })).rejects.toMatchObject({
			code: "translation_exists",
		});
		await expect(service.createTranslation({ sourceId: source.id, locale: "ko" })).rejects.toMatchObject({
			code: "translation_exists",
		});
		const ja = await service.createTranslation({ sourceId: en.id, locale: "ja" });
		expect(ja.translationGroupId).toBe(source.id);
		await expect(service.createTranslation({ sourceId: source.id, locale: "fr" })).rejects.toMatchObject({
			code: "invalid_input",
		});
	});

	it("번역본에 공통 필드를 저장하면 거부한다", async () => {
		const source = await createPost("common-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		await expect(
			service.saveDraft(en.id, {
				collection: "post",
				slug: "common-source",
				metadata: { title: "English", categoryId: source.working.metadata.categoryId },
				mdx: "Body",
				expectedVersion: en.version,
			} as never),
		).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("번역본은 원문이 공개돼야 발행되고, 공개 조회는 원문의 공통 값과 합친다", async () => {
		const source = await createPost("merge-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const saved = await service.saveDraft(en.id, {
			collection: "post",
			slug: "merge-source",
			metadata: { title: "English title", summary: "English summary" },
			mdx: "English body",
			expectedVersion: en.version,
		});

		await expect(publish(saved)).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: [expect.objectContaining({ code: "source_not_published" })],
		});

		await publish(source);
		const publishedEn = await publish(await store.getEntry(en.id));
		expect(publishedEn.status).toBe("published");
		expect(publishedEn.publishedSlug).toBe("merge-source");

		const english = await store.listPublishedEntries({ collections: ["post"], locale: "en" });
		const row = english.find((entry) => entry.id === en.id);
		expect(row?.metadata).toMatchObject({
			title: "English title",
			summary: "English summary",
			categoryId: source.working.metadata.categoryId,
			policy: "evergreen",
		});
		expect(row?.metadata.seoTitle).toBeUndefined();
		expect(english.some((entry) => entry.id === source.id)).toBe(false);

		const lookup = await store.getPublishedEntryBySlug({ collection: "post", slug: "merge-source", locale: "en" });
		expect(lookup.status === "current" && lookup.entry.id).toBe(en.id);
		const korean = await store.getPublishedEntryBySlug({ collection: "post", slug: "merge-source" });
		expect(korean.status === "current" && korean.entry.id).toBe(source.id);
		const japanese = await store.getPublishedEntryBySlug({ collection: "post", slug: "merge-source", locale: "ja" });
		expect(japanese.status).toBe("not_found");

		// 원문이 공개에서 빠지면 번역본도 공개 계층에서 빠진다.
		const archived = await store.archiveEntry({
			id: source.id,
			expectedVersion: (await store.getEntry(source.id)).version,
		});
		expect(archived.status).toBe("archived");
		const afterArchive = await store.getPublishedEntryBySlug({
			collection: "post",
			slug: "merge-source",
			locale: "en",
		});
		expect(afterArchive.status).toBe("not_found");
	});

	it("주소는 언어마다 따로다", async () => {
		const first = await createPost("shared-slug");
		await service.createTranslation({ sourceId: first.id, locale: "en" });
		await expect(createPost("shared-slug")).rejects.toMatchObject({ code: "slug_conflict" });
	});

	it("번역본이 있는 원문은 영구 삭제할 수 없다", async () => {
		const source = await createPost("delete-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
		await expect(store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version })).rejects.toMatchObject(
			{
				code: "has_translations",
			},
		);
		const trashedEn = await store.trashEntry({ id: en.id, expectedVersion: en.version });
		await store.permanentDeleteEntry({ id: en.id, expectedVersion: trashedEn.version });
		await store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version });
	});

	it("목록은 언어로 거르고 번역본의 태그·카테고리는 원문 값을 보여 준다", async () => {
		const source = await createPost("list-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const result = await store.listEntries({ collection: "post", locales: ["en"], pageSize: 100 });
		const row = result.items.find((item) => item.id === en.id);
		expect(result.items.every((item) => item.locale === "en")).toBe(true);
		expect(row?.translationGroupId).toBe(source.id);
		expect(row?.categoryId).toBe(source.working.metadata.categoryId);
		const byCategory = await store.listEntries({
			collection: "post",
			categoryIds: [source.working.metadata.categoryId as string],
			pageSize: 100,
		});
		expect(byCategory.items.map((item) => item.id).sort()).toEqual([source.id, en.id].sort());
	});

	it("record 컬렉션은 한 레코드 안에 언어별 이름을 둔다", async () => {
		const category = await service.createDraft({
			collection: "category",
			slug: "essay",
			metadata: { title: "에세이", translations: { en: { title: " Essay " }, ja: { title: "" } } },
			mdx: "",
		});
		expect(category.working.metadata.translations).toEqual({ en: { title: "Essay" } });
		await expect(
			service.createDraft({
				collection: "category",
				slug: "bad-locale",
				metadata: { title: "x", translations: { ko: { title: "x" } } },
				mdx: "",
			}),
		).rejects.toMatchObject({ code: "invalid_metadata_value" });
		await expect(
			service.createDraft({
				collection: "category",
				slug: "bad-field",
				metadata: { title: "x", translations: { en: { slug: "x" } } },
				mdx: "",
			}),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });
		await expect(
			service.createDraft({
				collection: "post",
				slug: "post-translations",
				metadata: { title: "x", translations: { en: { title: "x" } } },
				mdx: "",
			} as never),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });
	});
});
