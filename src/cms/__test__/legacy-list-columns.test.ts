import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "@bh2980/cms/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateLegacyListColumns, renameLegacyColumns } from "../legacy-list-columns.server";

describe("블로그의 예전 목록 열 이름 옮기기", () => {
	it("지금 모양과 예전 모양의 열 설정에서 category·tags를 필드 이름으로 바꾼다", () => {
		const next = renameLegacyColumns({
			collections: {
				post: {
					pageSize: 50,
					columns: {
						order: ["tags", "title", "category"],
						visibility: { category: false, tags: true },
						sizes: { tags: 240 },
					},
				},
				memo: { columns: { order: ["tags", "tagIds"], sizes: { tags: 200, tagIds: 210 } } },
			},
			columnSettings: { post: { order: ["category"], visibility: { category: true } } },
			editor: { width: "narrow" },
		});
		expect(next).toEqual({
			collections: {
				post: {
					pageSize: 50,
					columns: {
						order: ["tagIds", "title", "categoryId"],
						visibility: { categoryId: false, tagIds: true },
						sizes: { tagIds: 240 },
					},
				},
				// 지금 이름이 이미 있으면 그 값을 쓴다.
				memo: { columns: { order: ["tagIds"], sizes: { tagIds: 210 } } },
			},
			columnSettings: { post: { order: ["categoryId"], visibility: { categoryId: true } } },
			editor: { width: "narrow" },
		});
		expect(renameLegacyColumns(next)).toEqual(next);
	});

	describe("DB", () => {
		let pool: Pool;
		let schemaName: string;

		beforeAll(async () => {
			({ pool, schemaName } = await createIsolatedTestPool());
			await migrateContentStore(pool, { schema: schemaName });
		});

		afterAll(async () => {
			await dropIsolatedTestPool(pool, schemaName);
			await closeGlobalPool();
		});

		it("바뀐 설정만 고치고, 다시 돌리면 고칠 것이 없다", async () => {
			const legacy = { collections: { post: { columns: { order: ["category", "title"] } } } };
			const current = { collections: { post: { columns: { order: ["categoryId"] } } } };
			await pool.query(
				`INSERT INTO "${schemaName}".user_preferences (user_id, preferences, updated_at)
				 VALUES ('a', $1, NOW()), ('b', $2, NOW())`,
				[JSON.stringify(legacy), JSON.stringify(current)],
			);
			expect(await migrateLegacyListColumns({ pool, schema: schemaName })).toBe(1);
			const rows = await pool.query<{ user_id: string; preferences: unknown }>(
				`SELECT user_id, preferences FROM "${schemaName}".user_preferences ORDER BY user_id`,
			);
			expect(rows.rows).toEqual([
				{ user_id: "a", preferences: { collections: { post: { columns: { order: ["categoryId", "title"] } } } } },
				{ user_id: "b", preferences: current },
			]);
			expect(await migrateLegacyListColumns({ pool, schema: schemaName })).toBe(0);
		});
	});
});
