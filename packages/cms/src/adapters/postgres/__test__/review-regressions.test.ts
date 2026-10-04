import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareSnapshot, validateForPublish } from "../../../core/snapshot";
import { createBulkService } from "../../../services/bulk-service";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * 코드 리뷰(2026-09-26)에서 재현한 결함의 회귀 테스트. 실제 PostgreSQL과 운영 쓰기 경로를 쓴다.
 */
describe("review regressions", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let categoryId: string;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
		categoryId = (
			await service.createDraft({ collection: "category", slug: "cat", metadata: { title: "Cat" }, mdx: "" })
		).id;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const publishedPost = async (extra: Record<string, unknown> = {}, mdx = "본문") => {
		const draft = await service.createDraft({
			collection: "post",
			slug: unique("post"),
			metadata: { title: "글", categoryId, ...extra },
			mdx,
		});
		return store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	it("creates a record from its title alone and derives the slug", async () => {
		const tag = await service.createDraft({
			collection: "tag",
			slug: null,
			metadata: { title: "Type Script" },
			mdx: "",
		});
		expect(tag.status).toBe("published");
		expect(tag.publishedSlug).toBe("type-script");
	});

	it("refuses unarchive/restore from a published state instead of silently unpublishing", async () => {
		const post = await publishedPost();
		await expect(store.unarchiveEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});
		await expect(store.restoreEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});
		expect((await store.getPublishedEntryBySlug({ collection: "post", slug: post.publishedSlug ?? "" })).status).toBe(
			"current",
		);
	});

	it("restores a trashed record as an active (public) record", async () => {
		const tag = await service.createDraft({
			collection: "tag",
			slug: null,
			metadata: { title: unique("tag") },
			mdx: "",
		});
		const trashed = await store.trashEntry({ id: tag.id, expectedVersion: tag.version });
		const restored = await store.restoreEntry({ id: tag.id, expectedVersion: trashed.version });
		expect(restored.status).toBe("published");
	});

	it("permanently deletes only trashed entries, blocks referenced ones, and releases never-published slugs", async () => {
		const post = await publishedPost();
		await expect(store.permanentDeleteEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
			code: "invalid_status",
		});

		await service.createDraft({
			collection: "collection",
			slug: unique("series"),
			metadata: { title: "모음집", itemIds: [post.id] },
			mdx: "",
		});
		const trashed = await store.trashEntry({ id: post.id, expectedVersion: post.version });
		await expect(store.permanentDeleteEntry({ id: post.id, expectedVersion: trashed.version })).rejects.toMatchObject({
			code: "in_use",
			details: { usages: expect.arrayContaining([expect.objectContaining({ collection: "collection" })]) },
		});

		const slug = unique("never-published");
		const draft = await service.createDraft({ collection: "memo", slug, metadata: { title: "x" }, mdx: "x" });
		const trashedDraft = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
		await store.permanentDeleteEntry({ id: draft.id, expectedVersion: trashedDraft.version });
		const reused = await service.createDraft({ collection: "memo", slug, metadata: { title: "y" }, mdx: "y" });
		expect(reused.workingSlug).toBe(slug);
	});

	it("adds tags in bulk to an entry that has no tags yet", async () => {
		const tag = await service.createDraft({
			collection: "tag",
			slug: null,
			metadata: { title: unique("bulk") },
			mdx: "",
		});
		const post = await service.createDraft({
			collection: "post",
			slug: unique("untagged"),
			metadata: { title: "n", categoryId },
			mdx: "x",
		});
		const { results } = await createBulkService(store).run({
			op: "relation.add",
			field: "tagIds",
			items: [{ id: post.id, expectedVersion: post.version }],
			ids: [tag.id],
		});
		expect(results).toEqual([{ id: post.id, ok: true, version: post.version + 1 }]);
		expect((await store.getEntry(post.id)).working.metadata.tagIds).toEqual([tag.id]);
	});

	it("permanently deletes trashed items in bulk and names the entries that still reference a blocked one (v2 A3)", async () => {
		const target = await service.createDraft({
			collection: "post",
			slug: unique("replaced"),
			metadata: { title: "대체될 글", categoryId },
			mdx: "x",
		});
		const referrer = await service.createDraft({
			collection: "post",
			slug: unique("referrer"),
			metadata: { title: "참조하는 글", categoryId, policy: "deprecated", replacementPostId: target.id },
			mdx: "x",
		});
		const loose = await service.createDraft({
			collection: "memo",
			slug: unique("loose"),
			metadata: { title: "l" },
			mdx: "l",
		});
		const trashedTarget = await store.trashEntry({ id: target.id, expectedVersion: target.version });
		const trashedLoose = await store.trashEntry({ id: loose.id, expectedVersion: loose.version });

		const { results } = await createBulkService(store).run({
			op: "permanentDelete",
			items: [
				{ id: target.id, expectedVersion: trashedTarget.version },
				{ id: loose.id, expectedVersion: trashedLoose.version },
				{ id: referrer.id, expectedVersion: referrer.version },
			],
		});

		expect(results[0]).toMatchObject({ id: target.id, ok: false, error: "in_use" });
		expect(results[0]?.ok === false && results[0].usages?.map((usage) => usage.title)).toEqual(["참조하는 글"]);
		expect(results[1]).toEqual({ id: loose.id, ok: true, version: trashedLoose.version });
		expect(results[2]).toMatchObject({ id: referrer.id, ok: false, error: "invalid_status" });
		await expect(store.getEntry(loose.id)).rejects.toMatchObject({ code: "not_found" });
		expect((await store.getEntry(target.id)).status).toBe("trashed");
	});

	it("blocks publishing blocks without required attributes (§5.6)", async () => {
		const cases: [string, string][] = [
			["::::tabs\n:::tab\n첫\n:::\n:::tab\n둘\n:::\n::::", "missing_block_attribute"],
			["문장 :tooltip[표시] 끝", "missing_block_attribute"],
			[":::text-align\n가운데\n:::", "missing_block_attribute"],
			[':::text-align{align="justify"}\n가운데\n:::', "invalid_block_attribute"],
			[
				'::::tabs{defaultValue="없음"}\n:::tab{label="a"}\n1\n:::\n:::tab{label="b"}\n2\n:::\n::::',
				"invalid_block_attribute",
			],
			['::image{mediaId="11111111-1111-4111-8111-111111111111"}', "missing_image_alt"],
		];
		for (const [mdx, code] of cases) {
			const snapshot = await prepareSnapshot({ collection: "memo", slug: "m", metadata: { title: "m" }, mdx });
			const result = validateForPublish(snapshot, {
				targets: [],
				media: [{ id: "11111111-1111-4111-8111-111111111111" }],
			});
			expect(result.ready, mdx).toBe(false);
			expect(
				result.issues.map((issue) => issue.code),
				mdx,
			).toContain(code);
		}
	});

	it("duplicates without the publish date and with a hash that matches its metadata", async () => {
		const draft = await service.createDraft({
			collection: "post",
			slug: unique("dup"),
			metadata: { title: "원본", categoryId },
			mdx: "본문",
		});
		const source = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		expect(source.publishedAt).toBeInstanceOf(Date);
		const copy = await store.duplicateEntry({ id: source.id, title: "원본 (복사)" });
		expect(copy.publishedAt).toBeUndefined();
		expect(copy.working.metadata.title).toBe("원본 (복사)");
		const recomputed = await prepareSnapshot({
			collection: "post",
			slug: null,
			metadata: copy.working.metadata as never,
			mdx: copy.working.mdx,
		});
		expect(copy.working.contentHash).toBe(recomputed.contentHash);
	});

	it("can return to a previous public slug of the same entry", async () => {
		const post = await publishedPost();
		const original = post.publishedSlug as string;
		const renamed = await service.saveDraft(post.id, {
			collection: "post",
			slug: unique("renamed"),
			metadata: post.working.metadata as never,
			mdx: post.working.mdx,
			expectedVersion: post.version,
		});
		const republished = await store.publishEntry({ id: post.id, expectedVersion: renamed.version });
		const back = await service.saveDraft(post.id, {
			collection: "post",
			slug: original,
			metadata: post.working.metadata as never,
			mdx: post.working.mdx,
			expectedVersion: republished.version,
		});
		const final = await store.publishEntry({ id: post.id, expectedVersion: back.version });
		expect(final.publishedSlug).toBe(original);
	});

	it("filters the admin list by trash, tag and unpublished changes", async () => {
		const tag = await service.createDraft({
			collection: "tag",
			slug: null,
			metadata: { title: unique("filter") },
			mdx: "",
		});
		const tagged = await publishedPost({ tagIds: [tag.id] });
		const changed = await service.saveDraft(tagged.id, {
			collection: "post",
			slug: tagged.workingSlug,
			metadata: { ...(tagged.working.metadata as object), title: "수정 중" } as never,
			mdx: tagged.working.mdx,
			expectedVersion: tagged.version,
		});

		const byTag = await store.listEntries({ collection: "post", relations: { tagIds: [tag.id] } });
		expect(byTag.items.map((item) => item.id)).toEqual([tagged.id]);
		expect(byTag.items[0]?.hasUnpublishedChanges).toBe(true);
		expect(byTag.items[0]?.relations.tagIds).toEqual([{ id: tag.id, title: expect.any(String) }]);

		const withChanges = await store.listEntries({ collection: "post", hasUnpublishedChanges: true });
		expect(withChanges.items.map((item) => item.id)).toContain(tagged.id);

		const trashed = await store.trashEntry({ id: tagged.id, expectedVersion: changed.version });
		expect((await store.listEntries({ collection: "post", relations: { tagIds: [tag.id] } })).items).toHaveLength(0);
		const trash = await store.listEntries({ collection: "post", statuses: ["trashed"] });
		expect(trash.items.find((item) => item.id === tagged.id)?.trashedAt).toBeInstanceOf(Date);
		expect(trashed.status).toBe("trashed");
	});

	it("refuses to delete media that an unparsed draft or a template still mentions", async () => {
		const media = await store.createMediaAsset({
			filename: "a.png",
			mimeType: "image/png",
			byteSize: 10,
			stagingKey: "staging/a.png",
		});
		await store.completeMediaAsset({
			id: media.id,
			storageKey: "media/a.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
		});
		await store.createTemplate({
			name: unique("tpl"),
			mdx: `::image{mediaId="${media.id}" alt="a"}`,
		});
		await expect(store.beginMediaDelete(media.id)).rejects.toMatchObject({
			code: "in_use",
			details: { templates: 1 },
		});
		expect((await store.getMediaAsset(media.id))?.status).toBe("ready");
	});
});
