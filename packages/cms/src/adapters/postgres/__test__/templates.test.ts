import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ContentStore, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M5-BE-2 Body Templates Store Contract", () => {
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

	it("1. seeds templates for both editor types without reviving deleted templates", async () => {
		const templates = await store.listTemplates();
		expect(templates.length).toBeGreaterThanOrEqual(2);

		const algo = templates.find((t) => t.name === "알고리즘 풀이");
		if (!algo) throw new Error("알고리즘 풀이 템플릿이 없습니다.");
		expect(algo.mdx).toContain("## 문제");
		expect(algo.mdx).toContain("## 풀이");

		const tc = templates.find((t) => t.name === "Type Challenge 풀이");
		if (!tc) throw new Error("Type Challenge 풀이 템플릿이 없습니다.");
		expect(tc.mdx).toContain("### 질문");
		expect(tc.mdx).toContain("### 풀이");

		const postDefault = templates.find((t) => t.name === "일반 게시글");
		if (!postDefault) throw new Error("일반 게시글 템플릿이 없습니다.");
		expect(postDefault.mdx).toContain("## 개요");

		// Delete one template
		await store.deleteTemplate({ id: algo.id, expectedVersion: algo.version });

		// Re-run migration
		await migrateContentStore(pool, { schema: schemaName });

		// Verify deleted template did NOT resurrect (one-time seed guarantee)
		const remaining = await store.listTemplates();
		expect(remaining.find((t) => t.id === algo.id)).toBeUndefined();
		expect(remaining.find((t) => t.id === tc.id)).toBeDefined();
	});

	it("M12 post seed preserves same-name user templates and never resurrects deletions", async () => {
		const seeded = (await store.listTemplates()).find((template) => template.name === "일반 게시글");
		if (!seeded) throw new Error("일반 게시글 템플릿이 없습니다.");

		const userId = randomUUID();
		await pool.query(`UPDATE "${schemaName}".body_templates SET id = $1, mdx = $2 WHERE id = $3`, [
			userId,
			"사용자가 수정한 본문",
			seeded.id,
		]);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'seed_m12_default_post_template'`);
		await migrateContentStore(pool, { schema: schemaName });

		const preserved = (await store.listTemplates()).filter((template) => template.name === "일반 게시글");
		expect(preserved).toHaveLength(1);
		expect(preserved[0]).toMatchObject({ id: userId, mdx: "사용자가 수정한 본문" });

		await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
		await migrateContentStore(pool, { schema: schemaName });
		expect((await store.listTemplates()).some((template) => template.name === "일반 게시글")).toBe(false);
	});

	it("2. supports CRUD with optimistic concurrency (version checking)", async () => {
		// Create
		const created = await store.createTemplate({
			name: "새 포스트 템플릿",
			mdx: "## 개요\n\n내용 작성",
		});
		expect(created.id).toBeDefined();
		expect(created.version).toBe(1);
		expect(created.name).toBe("새 포스트 템플릿");

		// Read by id
		const fetched = await store.getTemplate(created.id);
		expect(fetched.name).toBe("새 포스트 템플릿");

		const allTemplates = await store.listTemplates();
		expect(allTemplates.some((t) => t.id === created.id)).toBe(true);

		// Update with correct expectedVersion
		const updated = await store.updateTemplate({
			id: created.id,
			expectedVersion: 1,
			mdx: "## 개요 (수정됨)\n\n내용 작성",
		});
		expect(updated.version).toBe(2);
		expect(updated.mdx).toContain("## 개요 (수정됨)");

		// Update with stale expectedVersion throws conflict
		await expect(
			store.updateTemplate({
				id: created.id,
				expectedVersion: 1,
				mdx: "conflict!",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));

		// Names are unique across the unified template list.
		await expect(
			store.createTemplate({
				name: "새 포스트 템플릿",
				mdx: "duplicate name",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));
		await store.createTemplate({ name: "CASE TEST", mdx: "original" });
		await expect(store.createTemplate({ name: "case test", mdx: "duplicate" })).rejects.toThrowError(
			expect.objectContaining({ code: "conflict" }),
		);

		// Delete with stale version throws conflict
		await expect(store.deleteTemplate({ id: created.id, expectedVersion: 1 })).rejects.toThrowError(
			expect.objectContaining({ code: "conflict" }),
		);

		// Delete succeeds with current version
		await store.deleteTemplate({ id: created.id, expectedVersion: 2 });
		await expect(store.getTemplate(created.id)).rejects.toThrowError(expect.objectContaining({ code: "not_found" }));
	});

	it("merges legacy collection templates and preserves same-name content", async () => {
		const legacy = await createIsolatedTestPool();
		try {
			await legacy.pool.query(`
				CREATE TABLE "${legacy.schemaName}".body_templates (
					id UUID PRIMARY KEY,
					name TEXT NOT NULL,
					for_collection TEXT NOT NULL CHECK (for_collection IN ('post', 'memo')),
					mdx TEXT NOT NULL,
					version INTEGER NOT NULL DEFAULT 1,
					created_at TIMESTAMPTZ NOT NULL,
					updated_at TIMESTAMPTZ NOT NULL
				);
				CREATE UNIQUE INDEX body_templates_collection_name_idx
				ON "${legacy.schemaName}".body_templates (for_collection, lower(name));
			`);
			const memoId = randomUUID();
			const postId = randomUUID();
			await legacy.pool.query(
				`INSERT INTO "${legacy.schemaName}".body_templates
				 (id, name, for_collection, mdx, version, created_at, updated_at)
				 VALUES ($1, '공통 이름', 'memo', '메모 본문', 3, '2026-01-01', '2026-01-02'),
				        ($2, '공통 이름', 'post', '포스트 본문', 5, '2026-02-01', '2026-02-02')`,
				[memoId, postId],
			);

			await migrateContentStore(legacy.pool, { schema: legacy.schemaName });
			const mergedStore = createContentStore(legacy.pool, { schema: legacy.schemaName });
			const merged = await mergedStore.listTemplates();
			expect(merged.find((template) => template.id === memoId)).toMatchObject({
				name: "공통 이름",
				mdx: "메모 본문",
				version: 3,
			});
			expect(merged.find((template) => template.id === postId)).toMatchObject({
				mdx: "포스트 본문",
				version: 5,
			});
			expect(merged.find((template) => template.id === postId)?.name).not.toBe("공통 이름");
			expect(new Set(merged.map((template) => template.name.toLowerCase())).size).toBe(merged.length);

			await migrateContentStore(legacy.pool, { schema: legacy.schemaName });
			expect(await mergedStore.listTemplates()).toEqual(merged);
			const column = await legacy.pool.query(
				`SELECT 1 FROM information_schema.columns
				 WHERE table_schema = $1 AND table_name = 'body_templates' AND column_name = 'for_collection'`,
				[legacy.schemaName],
			);
			expect(column.rowCount).toBe(0);
		} finally {
			await dropIsolatedTestPool(legacy.pool, legacy.schemaName);
		}
	});
});
