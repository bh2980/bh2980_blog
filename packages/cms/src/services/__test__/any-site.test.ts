import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	firstRelationField,
	recordCollection,
	requiredMetadata,
	titleFieldOf,
} from "../../../test/any-site";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../adapters/postgres/__test__/test-database";
import {
	type ContentStore,
	createContentStore,
	type Entry,
	migrateContentStore,
} from "../../adapters/postgres/content-store";
import type { Collection } from "../../core/collections";
import { createContentService } from "../content-service";

/**
 * 설정과 상관없는 본체 흐름(M10-1 재발 방지). 컬렉션·필드 이름을 적지 않고 지금 설정에서 찾는다.
 * 블로그 예시 설정과 다른 사이트 설정(`vitest.othersite.config.ts`) 둘 다로 돈다.
 */
describe("any site: core content flow", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	/** 대상 컬렉션의 공개 항목 하나(분류는 저장이 곧 공개다). */
	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		const entry =
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, entry.id);
		return entry.id;
	};

	const createContent = async (title: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("content"),
			metadata: await requiredMetadata(contentCollection, title, relationTarget),
			mdx: "Body text",
		});

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
		await closeGlobalPool();
	});

	it("saves a record from its title alone and derives the slug", async () => {
		const record = await service.createDraft({
			collection: recordCollection,
			slug: null,
			metadata: await requiredMetadata(recordCollection, "Any Site Record", relationTarget),
			mdx: "",
		});
		expect(record.status).toBe("published");
		expect(record.publishedSlug).toBe("any-site-record");
	});

	it("publishes a content entry built from the schema's required fields", async () => {
		const draft = await createContent("Published from schema");
		const published = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		expect(published.status).toBe("published");
		expect(published.published?.metadata.title).toBe("Published from schema");
	});

	it("reports a missing title as missing_field with the title field's label", async () => {
		const draft = await service.createDraft({
			collection: contentCollection,
			slug: unique("untitled"),
			metadata: {},
			mdx: "Body text",
		});
		await expect(store.publishEntry({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: expect.arrayContaining([
				{ code: "missing_field", path: "title", message: titleFieldOf(contentCollection).label },
			]),
		});
	});

	it("limits the title by the title field's own max", async () => {
		const { max, label } = titleFieldOf(contentCollection);
		if (max === undefined) return;
		const draft = await createContent("x".repeat(max));
		expect(draft.working.metadata.title).toHaveLength(max);
		await expect(createContent("x".repeat(max + 1))).rejects.toMatchObject({
			code: "field_too_long",
			issues: [{ code: "field_too_long", path: "title", message: label }],
		});
	});

	it("lists entries by title and names related entries by their title", async () => {
		const draft = await createContent("Findable headline");
		const list = await store.listEntries({ collection: contentCollection, titleContains: "Findable" });
		expect(list.items.map((item) => item.id)).toEqual([draft.id]);
		expect(list.items[0]?.title).toBe("Findable headline");
		const relation = firstRelationField(contentCollection);
		if (!relation) return;
		const value = draft.working.metadata[relation.name];
		if (value === undefined) return;
		const ids = Array.isArray(value) ? value : [value];
		expect(list.items[0]?.relations[relation.name]?.map((item) => item.id)).toEqual(ids);
		expect(list.items[0]?.relations[relation.name]?.every((item) => typeof item.title === "string")).toBe(true);
		const incoming = await store.getIncomingReferences({ targetId: String(ids[0]) });
		expect(incoming).toContainEqual(
			expect.objectContaining({ sourceId: draft.id, sourceTitle: "Findable headline", state: "working" }),
		);
	});

	it("duplicates with the title the caller gives and keeps it otherwise", async () => {
		const draft = await createContent("Original");
		const copy = await store.duplicateEntry({ id: draft.id, title: "Original (copy)" });
		expect(copy.working.metadata.title).toBe("Original (copy)");
		expect(copy.workingSlug).toBeNull();
		const same = await store.duplicateEntry({ id: draft.id });
		expect(same.working.metadata.title).toBe("Original");
	});
});
