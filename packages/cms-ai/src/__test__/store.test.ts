import {
	type ContentStore,
	createContentService,
	createContentStore,
	type Entry,
	migrateContentStore,
} from "@bh2980/cms/runtime";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "@bh2980/cms/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAction, listActions, resetAction, updateAction } from "../actions";
import { migrateAi } from "../migrate";
import { AI_ACTIONS } from "../registry";
import { type AiStore, createAiStore } from "../store";

describe("AI 기능 고친 값 저장소", () => {
	let pool: Pool;
	let schemaName: string;
	let content: ContentStore;
	let store: AiStore;
	/** 본체 표를 만들고 AI 플러그인 표를 만든다(`cms:db:migrate`와 같은 순서). */
	const migrate = async () => {
		await migrateContentStore(pool, { schema: schemaName });
		await migrateAi({ pool, schema: schemaName });
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrate();
		content = createContentStore(pool, { schema: schemaName });
		store = createAiStore({ pool, schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("기능 목록은 설정 순서대로이고, 고친 적 없으면 기본값·버전 0이다", async () => {
		const actions = await listActions(store);
		expect(actions.map((action) => action.key)).toEqual(Object.keys(AI_ACTIONS));
		expect(actions[0]).toMatchObject({ key: "slug", version: 0, updatedAt: null, overridden: [] });
	});

	it("고칠 수 있는 값만 저장하고, 기본값과 같은 값은 남기지 않으며, 버전이 다르면 막는다", async () => {
		const updated = await updateAction(store, "summary", 0, {
			enabled: false,
			prompt: "바꾼 지시문",
			label: "바꾼 이름",
			result: "candidates",
			maxCount: 5,
		});
		expect(updated).toMatchObject({
			enabled: false,
			prompt: "바꾼 지시문",
			label: "요약 만들기",
			result: "text",
			version: 1,
			overridden: ["enabled", "prompt"],
		});
		const row = await pool.query(`SELECT value FROM "${schemaName}".ai_action_overrides WHERE key = 'summary'`);
		expect(row.rows[0]?.value).toEqual({ enabled: false, prompt: "바꾼 지시문" });
		await expect(updateAction(store, "summary", 0, { enabled: true })).rejects.toMatchObject({ code: "conflict" });
		await expect(updateAction(store, "summary", 1, { prompt: "{{title}}" })).rejects.toMatchObject({
			code: "ai_invalid_input",
		});
		await expect(updateAction(store, "nope", 0, {})).rejects.toMatchObject({ code: "ai_unknown_action" });
	});

	it("기본값으로 되돌리면 지시문은 정의대로, 켜짐 여부는 그대로 둔다", async () => {
		const edited = await updateAction(store, "slug", 0, { prompt: "바꾼 지시문", enabled: false });
		const reset = await resetAction(store, "slug", edited.version);
		expect(reset.prompt).toBe(AI_ACTIONS.slug?.prompt);
		expect(reset.enabled).toBe(false);
		expect((await getAction(store, "slug")).prompt).toBe(AI_ACTIONS.slug?.prompt);
	});

	it("예전 기능 표의 고친 값을 한 번만 옮기고, 예전 표는 지우지 않는다", async () => {
		await pool.query(`
			CREATE TABLE "${schemaName}".ai_features (
				id UUID PRIMARY KEY, builtin TEXT UNIQUE, spec JSONB NOT NULL,
				version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`);
		await pool.query(
			`INSERT INTO "${schemaName}".ai_features (id, builtin, spec) VALUES
			 (gen_random_uuid(), 'codeFold', $1), (gen_random_uuid(), 'mediaAlt', $2), (gen_random_uuid(), NULL, '{}')`,
			[
				JSON.stringify({ prompt: "운영자 지시문", enabled: false, modelName: "m-1", inputs: ["code", "title"] }),
				JSON.stringify({ prompt: "지운 기능" }),
			],
		);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'migrate_ai_features_to_actions'`);
		await migrate();
		expect(await getAction(store, "codeFold")).toMatchObject({
			prompt: "운영자 지시문",
			enabled: false,
			modelName: "m-1",
			send: ["code"],
		});
		const keys = await pool.query(`SELECT key FROM "${schemaName}".ai_action_overrides ORDER BY key`);
		expect(keys.rows.map((row) => row.key)).not.toContain("mediaAlt");

		// 한 번 옮긴 뒤에는 예전 표가 바뀌어도 다시 옮기지 않는다.
		await pool.query(`UPDATE "${schemaName}".ai_features SET spec = '{"prompt": "다시"}' WHERE builtin = 'codeFold'`);
		await migrate();
		expect((await getAction(store, "codeFold")).prompt).toBe("운영자 지시문");
		const legacy = await pool.query(`SELECT count(*)::int AS n FROM "${schemaName}".ai_features`);
		expect(legacy.rows[0]?.n).toBe(3);
	});

	it("같은 컬렉션·언어에서 다른 글이 쓰는 주소를 찾는다", async () => {
		const entry = await createContentService<Entry>(content).createDraft({
			collection: "category",
			slug: "used-address",
			metadata: { title: "주소 확인" },
			mdx: "",
		});
		const slugs = ["used-address", "free-address"];
		expect(await store.findTakenSlugs({ collection: "category", locale: "ko", slugs })).toEqual(
			new Set(["used-address"]),
		);
		expect(await store.findTakenSlugs({ collection: "category", locale: "en", slugs })).toEqual(new Set());
		expect(await store.findTakenSlugs({ collection: "category", locale: "ko", slugs, entryId: entry.id })).toEqual(
			new Set(),
		);
	});
});
