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

	const statusOf = async (id: string) =>
		(await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
			?.status;
	const versionOf = async (id: string) =>
		(await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
			?.version as number;

	it("원문을 휴지통으로 보내면 번역본도 함께 가고, 복원하면 함께 버린 번역본만 돌아온다(v3)", async () => {
		const source = await createPost("trash-group-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const ja = await service.createTranslation({ sourceId: source.id, locale: "ja" });
		await store.trashEntry({ id: ja.id, expectedVersion: ja.version });

		const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
		expect(await statusOf(en.id)).toBe("trashed");
		// 열어 둔 번역본 편집 화면이 충돌로 알아차린다.
		expect(await versionOf(en.id)).toBe(en.version + 1);

		await expect(store.restoreEntry({ id: en.id, expectedVersion: await versionOf(en.id) })).rejects.toMatchObject({
			code: "source_trashed",
		});

		await store.restoreEntry({ id: source.id, expectedVersion: trashed.version });
		expect(await statusOf(source.id)).toBe("draft");
		expect(await statusOf(en.id)).toBe("draft");
		expect(await statusOf(ja.id)).toBe("trashed");

		// 원문이 살아 있으면 따로 지운 번역본도 복원된다.
		await store.restoreEntry({ id: ja.id, expectedVersion: await versionOf(ja.id) });
		expect(await statusOf(ja.id)).toBe("draft");
	});

	it("원문 보관·보관 해제는 번역본에도 적용된다(v3)", async () => {
		const source = await createPost("archive-group-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const archived = await store.archiveEntry({ id: source.id, expectedVersion: source.version });
		expect(await statusOf(en.id)).toBe("archived");
		await store.unarchiveEntry({ id: source.id, expectedVersion: archived.version });
		expect(await statusOf(en.id)).toBe("draft");

		// 번역본만 보관하면 원문은 그대로다.
		await store.archiveEntry({ id: en.id, expectedVersion: await versionOf(en.id) });
		expect(await statusOf(source.id)).toBe("draft");
	});

	it("원문을 영구 삭제하면 휴지통의 번역본도 함께 지우고, 휴지통 밖 번역본이 있으면 거부한다(v3)", async () => {
		const source = await createPost("delete-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });

		// 원문만 휴지통에 있고 번역본이 살아 있는 예전 데이터.
		await pool.query(`UPDATE "${schemaName}".entries SET status = 'draft', trashed_at = NULL WHERE id = $1`, [en.id]);
		await expect(store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version })).rejects.toMatchObject(
			{ code: "has_translations" },
		);

		await store.trashEntry({ id: en.id, expectedVersion: await versionOf(en.id) });
		await store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version });
		expect(await statusOf(source.id)).toBeUndefined();
		expect(await statusOf(en.id)).toBeUndefined();
	});

	it("묶음 보기 목록은 원문 한 줄에 언어별 콘텐츠를 딸려 보이고, 검색·언어 필터는 묶음 전체로 본다(v3)", async () => {
		const source = await createPost("group-list-source");
		const en = await service.createTranslation({ sourceId: source.id, locale: "en" });
		await service.saveDraft(en.id, {
			collection: "post",
			slug: "group-list-source",
			metadata: { title: "Grouped English title" },
			mdx: "Body",
			expectedVersion: en.version,
		} as never);
		const ja = await service.createTranslation({ sourceId: source.id, locale: "ja" });
		await store.trashEntry({ id: ja.id, expectedVersion: ja.version });
		const lonely = await createPost("group-list-lonely");

		const all = await store.listEntries({ collection: "post", groupTranslations: true, pageSize: 100 });
		const ids = all.items.map((item) => item.id);
		expect(ids).toContain(source.id);
		expect(ids).toContain(lonely.id);
		expect(ids).not.toContain(en.id);
		const row = all.items.find((item) => item.id === source.id);
		expect(row?.translations?.map((member) => [member.locale, member.isSource, member.status])).toEqual([
			["ko", true, "draft"],
			["en", false, "draft"],
		]);
		expect(all.items.find((item) => item.id === lonely.id)?.translations?.map((member) => member.locale)).toEqual([
			"ko",
		]);

		const byEnglishTitle = await store.listEntries({
			collection: "post",
			groupTranslations: true,
			search: "Grouped English",
			pageSize: 100,
		});
		expect(byEnglishTitle.items.map((item) => item.id)).toEqual([source.id]);

		const withEnglish = await store.listEntries({
			collection: "post",
			groupTranslations: true,
			locales: ["en"],
			pageSize: 100,
		});
		expect(withEnglish.items.map((item) => item.id)).toContain(source.id);
		expect(withEnglish.items.map((item) => item.id)).not.toContain(lonely.id);
		// 휴지통의 번역본은 "있는 언어"로 치지 않는다.
		const withJapanese = await store.listEntries({
			collection: "post",
			groupTranslations: true,
			locales: ["ja"],
			pageSize: 100,
		});
		expect(withJapanese.items.map((item) => item.id)).not.toContain(source.id);
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
