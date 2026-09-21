import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M5-BE-1 Duplicate Entry Contract", () => {
	let pool: Pool;
	let schemaName: string;
	let store: any;

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

	it("duplicates entry draft with '(복사)' title, empty slug, draft status, and preserved references", async () => {
		const media = await store.createMediaAsset({
			filename: "sample.png",
			mimeType: "image/png",
			byteSize: 1024,
			width: 100,
			height: 100,
			stagingKey: "staging/sample.png",
		});
		const mediaId = media.id;
		const folder = await store.createFolder({ collection: "post", name: "Tech" });

		// Seed a published entry with folder and working references
		const original = await store.createEntryWithReferences({
			snapshot: {
				collection: "post",
				slug: "orig-slug",
				metadata: {
					title: "Original Post",
					categoryId: "00000000-0000-0000-0000-000000000001",
					tagIds: ["00000000-0000-0000-0000-000000000002"],
				},
				mdx: "Hello world ![img](mediaId)",
				schemaVersion: 1,
				contentHash: "hash-orig",
				issues: [],
			},
			references: [
				{
					kind: "media",
					targetId: mediaId,
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 13 }],
				},
			],
			folderId: folder.id,
		});

		// Publish original so it has published body/status
		await store.publishEntry({ id: original.id, expectedVersion: original.version });
		const publishedOrig = await store.getEntry(original.id);
		expect(publishedOrig.status).toBe("published");
		expect(publishedOrig.publishedSlug).toBe("orig-slug");

		// Execute duplicate
		const duplicated = await store.duplicateEntry({ id: original.id });

		// 1. Different ID, version 1, draft status
		expect(duplicated.id).toBeDefined();
		expect(duplicated.id).not.toBe(original.id);
		expect(duplicated.version).toBe(1);
		expect(duplicated.status).toBe("draft");

		// 2. Title has '(복사)' suffix, slug is null/empty
		expect(duplicated.working.metadata.title).toBe("Original Post (복사)");
		expect(duplicated.workingSlug).toBeNull();
		expect(duplicated.publishedSlug).toBeNull();
		expect(duplicated.published).toBeUndefined();

		// 3. Same folder preserved (verified in entries table)
		const dbRow = await pool.query<{ folder_id: string | null }>(
			`SELECT folder_id FROM "${schemaName}".entries WHERE id = $1`,
			[duplicated.id],
		);
		expect(dbRow.rows[0].folder_id).toBe(folder.id);

		// 4. Working references preserved (media reuse without re-upload)
		const refs = await store.getWorkingReferences({ entryId: duplicated.id });
		expect(refs).toHaveLength(1);
		expect(refs[0].kind).toBe("media");
		expect(refs[0].targetId).toBe(mediaId);

		// 5. MDX and category/tag metadata preserved
		expect(duplicated.working.mdx).toBe("Hello world ![img](mediaId)");
		expect(duplicated.working.metadata.categoryId).toBe("00000000-0000-0000-0000-000000000001");
		expect(duplicated.working.metadata.tagIds).toEqual(["00000000-0000-0000-0000-000000000002"]);
	});

	it("throws not_found when duplicating non-existent entry", async () => {
		const ghostId = randomUUID();
		await expect(store.duplicateEntry({ id: ghostId })).rejects.toThrowError(
			expect.objectContaining({ code: "not_found" }),
		);
	});
});
