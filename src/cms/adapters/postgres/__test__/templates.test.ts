import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M5-BE-2 Body Templates Store Contract", () => {
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

	it("1. seeds initial 2 memo templates on first migration without reviving upon re-migration", async () => {
		const templates = await store.listTemplates();
		expect(templates.length).toBeGreaterThanOrEqual(2);

		const algo = templates.find((t: any) => t.name === "알고리즘 풀이");
		expect(algo).toBeDefined();
		expect(algo.forCollection).toBe("memo");
		expect(algo.mdx).toContain("## 문제");
		expect(algo.mdx).toContain("## 풀이");

		const tc = templates.find((t: any) => t.name === "Type Challenge 풀이");
		expect(tc).toBeDefined();
		expect(tc.forCollection).toBe("memo");
		expect(tc.mdx).toContain("### 질문");
		expect(tc.mdx).toContain("### 풀이");

		const postDefault = templates.find((t: any) => t.name === "일반 게시글");
		expect(postDefault).toBeDefined();
		expect(postDefault.forCollection).toBe("post");
		expect(postDefault.mdx).toContain("## 개요");

		// Delete one template
		await store.deleteTemplate({ id: algo.id, expectedVersion: algo.version });

		// Re-run migration
		await migrateContentStore(pool, { schema: schemaName });

		// Verify deleted template did NOT resurrect (one-time seed guarantee)
		const remaining = await store.listTemplates();
		expect(remaining.find((t: any) => t.id === algo.id)).toBeUndefined();
		expect(remaining.find((t: any) => t.id === tc.id)).toBeDefined();
	});

	it("M12 post seed preserves same-name user templates and never resurrects deletions", async () => {
		const seeded = (await store.listTemplates({ forCollection: "post" })).find(
			(template: any) => template.name === "일반 게시글",
		);
		expect(seeded).toBeDefined();

		const userId = randomUUID();
		await pool.query(`UPDATE "${schemaName}".body_templates SET id = $1, mdx = $2 WHERE id = $3`, [
			userId,
			"사용자가 수정한 본문",
			seeded.id,
		]);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'seed_m12_default_post_template'`);
		await migrateContentStore(pool, { schema: schemaName });

		const preserved = (await store.listTemplates({ forCollection: "post" })).filter(
			(template: any) => template.name === "일반 게시글",
		);
		expect(preserved).toHaveLength(1);
		expect(preserved[0]).toMatchObject({ id: userId, mdx: "사용자가 수정한 본문" });

		await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
		await migrateContentStore(pool, { schema: schemaName });
		expect(
			(await store.listTemplates({ forCollection: "post" })).some((template: any) => template.name === "일반 게시글"),
		).toBe(false);
	});

	it("2. supports CRUD with optimistic concurrency (version checking)", async () => {
		// Create
		const created = await store.createTemplate({
			name: "새 포스트 템플릿",
			forCollection: "post",
			mdx: "## 개요\n\n내용 작성",
		});
		expect(created.id).toBeDefined();
		expect(created.version).toBe(1);
		expect(created.name).toBe("새 포스트 템플릿");
		expect(created.forCollection).toBe("post");

		// Read by id
		const fetched = await store.getTemplate(created.id);
		expect(fetched.name).toBe("새 포스트 템플릿");

		// Filter list by forCollection
		const postTemplates = await store.listTemplates({ forCollection: "post" });
		expect(postTemplates.some((t: any) => t.id === created.id)).toBe(true);
		const memoTemplates = await store.listTemplates({ forCollection: "memo" });
		expect(memoTemplates.some((t: any) => t.id === created.id)).toBe(false);

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

		// Duplicate name in same collection throws conflict
		await expect(
			store.createTemplate({
				name: "새 포스트 템플릿",
				forCollection: "post",
				mdx: "duplicate name",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "conflict" }));

		// Delete with stale version throws conflict
		await expect(store.deleteTemplate({ id: created.id, expectedVersion: 1 })).rejects.toThrowError(
			expect.objectContaining({ code: "conflict" }),
		);

		// Delete succeeds with current version
		await store.deleteTemplate({ id: created.id, expectedVersion: 2 });
		await expect(store.getTemplate(created.id)).rejects.toThrowError(expect.objectContaining({ code: "not_found" }));
	});

	it("3. rejects invalid forCollection", async () => {
		await expect(
			store.createTemplate({
				name: "잘못된 컬렉션",
				forCollection: "category", // only 'post' and 'memo' allowed
				mdx: "invalid",
			}),
		).rejects.toThrowError(expect.objectContaining({ code: "invalid_input" }));
	});
});
