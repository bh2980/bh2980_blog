import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixtureCorpus } from "@/cms/migrate-from-files/__test__/fixture-corpus";
import { buildImportPlan } from "@/cms/migrate-from-files/import-plan";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M6-BE-2 importEntries / readExportSnapshot 계약", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let plan: Awaited<ReturnType<typeof buildImportPlan>>;
	let fixture: { root: string; cleanup: () => void };

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });

		fixture = createFixtureCorpus({ memoStatus: null });
		plan = await buildImportPlan(readLegacyCorpus(fixture.root));
	});

	afterAll(async () => {
		fixture?.cleanup();
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("1. 전체 항목을 한 번에 적재하고 published/draft 상태를 그대로 만든다", async () => {
		const result = await store.importEntries(plan.items);
		expect(result.imported).toBe(plan.items.length);
		expect(result.skipped).toBe(0);

		const snapshot = await store.readExportSnapshot();
		expect(snapshot.entries).toHaveLength(plan.items.length);
		expect(snapshot.entries.filter((entry) => entry.status === "published")).toHaveLength(5);
		expect(snapshot.entries.filter((entry) => entry.status === "draft")).toHaveLength(1);

		const published = snapshot.entries.find((entry) => entry.collection === "post");
		expect(published?.published).toBeDefined();
		expect(published?.publishedSlug).toBe("첫-글");
		expect(published?.firstPublishedAt).toBeNull();
		expect(published?.lastPublishedAt).toBeNull();
		expect(published?.publishedAt?.toISOString()).toBe("2026-01-02T03:04:00.000Z");

		const draft = snapshot.entries.find((entry) => entry.status === "draft");
		expect(draft?.published).toBeUndefined();
		expect(draft?.publishedAt).toBeNull();
		expect(draft?.workingSlug).toBe("메모-하나");
	});

	it("2. 재실행은 전부 skip하고 아무것도 덮어쓰지 않는다", async () => {
		const result = await store.importEntries(plan.items);
		expect(result.imported).toBe(0);
		expect(result.skipped).toBe(plan.items.length);
		expect(result.items.every((item) => item.outcome === "skipped")).toBe(true);
	});

	it("3. 같은 ID에 다른 본문이면 conflict로 중단하고 기존 데이터를 보존한다", async () => {
		const target = plan.items.find((item) => item.collection === "post");
		expect(target).toBeDefined();
		const conflicting = {
			...target!,
			working: { ...target!.working, mdx: `${target!.working.mdx}\n\n추가된 문장` },
		};

		await expect(store.importEntries([conflicting])).rejects.toBeInstanceOf(CmsError);

		const snapshot = await store.readExportSnapshot();
		const stored = snapshot.entries.find((entry) => entry.id === target!.id);
		expect(stored?.working.mdx).toBe(target!.working.mdx);
	});

	it("4. 다른 ID가 같은 collection+slug를 쓰면 conflict로 중단한다", async () => {
		const memo = plan.items.find((item) => item.collection === "memo");
		expect(memo).toBeDefined();
		const duplicate = {
			...memo!,
			id: "99999999-9999-4999-8999-999999999999",
		};

		await expect(store.importEntries([duplicate])).rejects.toBeInstanceOf(CmsError);
		const snapshot = await store.readExportSnapshot();
		expect(snapshot.entries.some((entry) => entry.id === duplicate.id)).toBe(false);
	});

	it("5. 참조와 본문을 그대로 읽어낼 수 있고 순서가 결정적이다", async () => {
		const first = await store.readExportSnapshot();
		const second = await store.readExportSnapshot();

		expect(first.entries.map((entry) => `${entry.collection}/${entry.id}`)).toEqual(
			second.entries.map((entry) => `${entry.collection}/${entry.id}`),
		);

		const post = first.entries.find((entry) => entry.collection === "post");
		const postRefs = first.references.filter((reference) => reference.entryId === post?.id);
		expect(postRefs.some((reference) => reference.kind === "category")).toBe(true);
		expect(postRefs.some((reference) => reference.kind === "tag")).toBe(true);

		const collection = first.entries.find((entry) => entry.collection === "collection");
		const itemIds = (collection?.working.metadata as { itemIds?: string[] }).itemIds;
		const memoId = first.entries.find((entry) => entry.collection === "memo")?.id;
		expect(itemIds).toContain(memoId);
	});
});
