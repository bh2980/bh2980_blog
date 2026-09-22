import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "@/cms/adapters/postgres/__test__/test-database";
import { migrateContentStore } from "@/cms/adapters/postgres/content-store";
import {
	assertCmsSchemaReady,
	assertConnectedToCmsDatabase,
	assertProductionOptIn,
	PRODUCTION_APPLY_FLAG,
	resolveProductionDatabase,
} from "@/cms/migrate-from-files/production-guard";

/**
 * M9-BE-1: 운영 이관 가드. 여기서 막지 못하면 공유 운영 DB에 잘못된 대상으로 쓴다.
 */
describe("production migration guard", () => {
	it("명시적 opt-in 없이는 실행하지 않는다", () => {
		expect(() => assertProductionOptIn({})).toThrow(new RegExp(PRODUCTION_APPLY_FLAG));
		expect(() => assertProductionOptIn({ [PRODUCTION_APPLY_FLAG]: "true" })).toThrow();
		expect(() => assertProductionOptIn({ [PRODUCTION_APPLY_FLAG]: "1" })).not.toThrow();
	});

	it("CMS_DATABASE_URL이 없으면 실패한다", () => {
		expect(() => resolveProductionDatabase({ env: {} })).toThrow(/CMS_DATABASE_URL/);
	});

	it("기본 schema는 public이고 시험 격리 schema는 거부한다", () => {
		const target = resolveProductionDatabase({ env: { CMS_DATABASE_URL: "postgres://prod/cms" } });
		expect(target.schemaName).toBe("public");

		expect(() =>
			resolveProductionDatabase({ env: { CMS_DATABASE_URL: "postgres://prod/cms" }, schemaName: "cms_m6_abcd" }),
		).toThrow(/시험 격리 schema/);
	});

	it("운영 URL과 시험 URL이 같은 DB면 중단한다", () => {
		expect(() =>
			resolveProductionDatabase({
				env: { CMS_DATABASE_URL: "postgres://same/cms", CMS_TEST_DATABASE_URL: "postgres://same/cms" },
			}),
		).toThrow(/같은 DB를 가리킵니다/);

		// 포트·후행 슬래시 표기가 달라도 같은 DB로 본다.
		expect(() =>
			resolveProductionDatabase({
				env: { CMS_DATABASE_URL: "postgres://host:5432/cms", CMS_TEST_DATABASE_URL: "postgres://host/cms/" },
			}),
		).toThrow(/같은 DB를 가리킵니다/);

		// 다른 DB면 통과한다.
		expect(
			resolveProductionDatabase({
				env: { CMS_DATABASE_URL: "postgres://prod/cms", CMS_TEST_DATABASE_URL: "postgres://test/cms_test" },
			}).schemaName,
		).toBe("public");
	});

	it("식별자가 아닌 schema 이름은 거부한다", () => {
		expect(() =>
			resolveProductionDatabase({ env: { CMS_DATABASE_URL: "postgres://prod/cms" }, schemaName: "public; DROP" }),
		).toThrow(/schema 이름이 올바르지 않습니다/);
	});
});

/**
 * 실제 DB가 필요한 가드. 격리 시험 schema(`cms_test_*`)를 쓴다.
 * `CMS_TEST_DATABASE_URL`이 없으면 이 블록만 건너뛴다(다른 실DB 테스트와 같은 조건).
 */
const hasTestDatabase = Boolean(process.env.CMS_TEST_DATABASE_URL);
const describeWithDb = hasTestDatabase ? describe : describe.skip;

describeWithDb("production migration guard (실DB)", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("연결된 DB가 DSN과 다르면 중단한다", async () => {
		const url = process.env.CMS_TEST_DATABASE_URL as string;
		const otherDb = new URL(url);
		otherDb.pathname = "/definitely_not_the_cms_db";

		await expect(assertConnectedToCmsDatabase(pool, otherDb.toString())).rejects.toThrow(/연결된 DB/);
		await expect(assertConnectedToCmsDatabase(pool, url)).resolves.toMatchObject({ isSuperuser: false });
	});

	it("CMS 테이블이 없으면 DDL 없이 중단하고, 준비되면 통과한다", async () => {
		await expect(assertCmsSchemaReady(pool, schemaName)).rejects.toThrow(/CMS 테이블/);

		await migrateContentStore(pool, { schema: schemaName });

		const tables = await assertCmsSchemaReady(pool, schemaName);
		expect(tables).toContain("entries");
		expect(tables).toContain("cms_migrations");

		// 두 번 불러도 같은 결과다(가드가 DDL을 하지 않는다).
		expect(await assertCmsSchemaReady(pool, schemaName)).toEqual(tables);
	});
});
