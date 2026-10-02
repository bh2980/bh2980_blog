import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUILTIN_AI_FEATURES } from "@/cms/ai/builtins";
import { createContentService } from "../../../services/content-service";
import { type ContentStore, createContentStore, type Entry, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("v2 D AI 기능 저장소", () => {
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
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("기능 목록을 기능마다 한 번 넣고 목록 순서대로 보이며, 지운 줄은 다시 마이그레이션해도 살리지 않는다", async () => {
		const features = await store.listAiFeatures();
		expect(features.map((feature) => feature.builtin)).toEqual(Object.keys(BUILTIN_AI_FEATURES));

		await pool.query(`DELETE FROM "${schemaName}".ai_features WHERE builtin = 'imageCaption'`);
		await migrateContentStore(pool, { schema: schemaName });
		expect((await store.listAiFeatures()).some((feature) => feature.builtin === "imageCaption")).toBe(false);
	});

	it("기능 목록에 없는 줄은 보이지 않는다", async () => {
		await pool.query(
			`INSERT INTO "${schemaName}".ai_features (id, builtin, spec) VALUES (gen_random_uuid(), NULL, '{}')`,
		);
		expect((await store.listAiFeatures()).every((feature) => feature.builtin !== null)).toBe(true);
	});

	it("고칠 수 있는 부분만 저장하고, 정해 둔 부분은 기능 정의대로 남으며, 버전이 다르면 막는다", async () => {
		const summary = (await store.listAiFeatures()).find((feature) => feature.builtin === "summary");
		if (!summary) throw new Error("요약 기능이 없습니다.");
		const { id, builtin: _b, version, createdAt: _c, updatedAt: _u, ...spec } = summary;
		const updated = await store.updateAiFeature({
			id,
			expectedVersion: version,
			spec: { ...spec, enabled: false, prompt: "바꾼 지시문", name: "바꾼 이름", target: "slug" },
		});
		expect(updated).toMatchObject({
			enabled: false,
			prompt: "바꾼 지시문",
			name: "요약 만들기",
			target: "summary",
			version: version + 1,
		});
		await expect(store.updateAiFeature({ id, expectedVersion: version, spec })).rejects.toMatchObject({
			code: "conflict",
		});
	});

	it("기본값으로 되돌리면 지시문은 처음 정의로, 켜짐 여부는 그대로 둔다", async () => {
		const slug = (await store.listAiFeatures()).find((feature) => feature.builtin === "slug");
		if (!slug) throw new Error("주소 기본 기능이 없습니다.");
		const { id, builtin: _b, version, createdAt: _c, updatedAt: _u, ...spec } = slug;
		const edited = await store.updateAiFeature({
			id,
			expectedVersion: version,
			spec: { ...spec, prompt: "바꾼 지시문", enabled: false },
		});
		const reset = await store.resetAiFeature({ id, expectedVersion: edited.version });
		expect(reset.prompt).toBe(BUILTIN_AI_FEATURES.slug?.spec.prompt);
		expect(reset.enabled).toBe(false);
	});

	it("같은 컬렉션·언어에서 다른 글이 쓰는 주소를 찾는다", async () => {
		const entry = await createContentService<Entry>(store).createDraft({
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
