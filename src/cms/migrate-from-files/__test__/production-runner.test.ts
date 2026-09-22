import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "@/cms/adapters/postgres/__test__/test-database";
import { migrateContentStore } from "@/cms/adapters/postgres/content-store";
import { buildImportPlan } from "@/cms/migrate-from-files/import-plan";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { planDigest, planProductionApply, runProductionApply } from "@/cms/migrate-from-files/production-runner";
import { createFixtureCorpus } from "./fixture-corpus";

/**
 * M9-BE-1: 운영 이관 실행기.
 *
 * 실제 운영 대상은 `public`이지만, 여기서는 성질만 검증한다:
 * DDL 없음 / 사전조사에서 깨끗하지 않으면 쓰지 않음 / 같은 내용은 skip /
 * 내용이 다르면 **덮어쓰지 않고** 중단 / 원본 지문이 바뀌면 중단.
 */
const hasTestDatabase = Boolean(process.env.CMS_TEST_DATABASE_URL);
const describeWithDb = hasTestDatabase ? describe : describe.skip;

describe("production apply plan (DB 불필요)", () => {
	let fixture: ReturnType<typeof createFixtureCorpus>;

	beforeAll(() => {
		fixture = createFixtureCorpus();
	});

	afterAll(() => {
		fixture.cleanup();
	});

	it("같은 원본이면 같은 지문, 본문이 바뀌면 다른 지문", async () => {
		const first = await buildImportPlan(readLegacyCorpus(fixture.root));
		const second = await buildImportPlan(readLegacyCorpus(fixture.root));

		expect(planDigest(first)).toBe(planDigest(second));
		expect(planDigest(first)).toMatch(/^[0-9a-f]{64}$/);

		const tampered = { ...first, items: first.items.map((item, index) => (index === 0 ? { ...item } : item)) };
		tampered.items[0] = {
			...tampered.items[0],
			working: { ...tampered.items[0].working, contentHash: "different-hash" },
		} as (typeof first.items)[number];

		expect(planDigest(tampered as typeof first)).not.toBe(planDigest(first));
	});

	it("dry-run은 DB에 접속하지 않고 지문과 건수만 남긴다", async () => {
		const outDir = mkdtempSync(path.join(tmpdir(), "cms-m9-out-"));
		try {
			const { report, outputPath } = await planProductionApply({
				root: fixture.root,
				out: path.join(outDir, "plan.json"),
			});

			expect(report.apply).toBeNull();
			expect(report.connection).toBeNull();
			expect(report.schemaName).toBe("(dry-run)");
			expect(report.counts.items).toBeGreaterThan(0);
			expect(report.blocking).toEqual([]);
			expect(existsSync(outputPath)).toBe(true);
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});

describeWithDb("production apply runner (실DB)", () => {
	let pool: Pool;
	let schemaName: string;
	let fixture: ReturnType<typeof createFixtureCorpus>;
	let outDir: string;

	beforeAll(() => {
		fixture = createFixtureCorpus();
		outDir = mkdtempSync(path.join(tmpdir(), "cms-m9-out-"));
	});

	afterAll(async () => {
		fixture.cleanup();
		rmSync(outDir, { recursive: true, force: true });
		await closeGlobalPool();
	});

	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		// 운영 경로는 DDL을 하지 않으므로, 스키마 준비는 승인된 절차가 미리 해 둔 상태를 흉내 낸다.
		await migrateContentStore(pool, { schema: schemaName });
	});

	afterEach(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
	});

	const applyOptions = (extra: Record<string, unknown> = {}) => ({
		root: fixture.root,
		pool,
		schemaName,
		out: path.join(outDir, `${schemaName}-${Math.random().toString(16).slice(2)}.json`),
		...extra,
	});

	const entriesOf = async () => {
		const res = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${schemaName}".entries`);
		return Number(res.rows[0]?.count ?? "0");
	};

	it("깨끗한 대상에 한 번 적재하고 검증까지 통과한다", async () => {
		const plan = await buildImportPlan(readLegacyCorpus(fixture.root));

		const { report } = await runProductionApply(applyOptions());

		expect(report.apply?.imported).toBe(plan.counts.items);
		expect(report.apply?.skipped).toBe(0);
		expect(report.targetState?.entryCount).toBe(0);
		expect(report.verification?.slugSetsMatch).toBe(true);
		expect(report.verification?.entryCount).toBe(plan.counts.items);
		expect(report.verification?.publishedEntryCount).toBe(plan.counts.published);
		expect(report.verification?.draftEntryCount).toBe(plan.counts.draft);
		expect(await entriesOf()).toBe(plan.counts.items);
	});

	it("원본 지문이 다르면 쓰지 않고 중단한다", async () => {
		await expect(runProductionApply(applyOptions({ expectedDigest: "0".repeat(64) }))).rejects.toThrow(
			/원본 지문이 승인된 값과 다릅니다/,
		);

		expect(await entriesOf()).toBe(0);
	});

	it("이미 적재된 대상은 기본값으로 다시 쓰지 않는다", async () => {
		await runProductionApply(applyOptions());

		await expect(runProductionApply(applyOptions())).rejects.toThrow(/깨끗하지 않아/);
	});

	it("의도된 재실행은 같은 내용을 skip하고 새로 쓰지 않는다", async () => {
		const first = await runProductionApply(applyOptions());
		const second = await runProductionApply(applyOptions({ allowExistingTarget: true }));

		expect(second.report.apply?.imported).toBe(0);
		expect(second.report.apply?.skipped).toBe(first.report.apply?.imported);
		expect(await entriesOf()).toBe(first.report.apply?.imported ?? -1);
	});

	it("대상이 편집돼 내용이 갈리면 덮어쓰지 않고 충돌로 중단한다", async () => {
		const plan = await buildImportPlan(readLegacyCorpus(fixture.root));
		await runProductionApply(applyOptions());

		const targetId = plan.items[0]?.id as string;
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = '운영에서 직접 고친 본문', content_hash = 'human-edit'
			 WHERE entry_id = $1 AND state = 'working'`,
			[targetId],
		);

		await expect(runProductionApply(applyOptions({ allowExistingTarget: true }))).rejects.toThrow(/conflict/);

		// 덮어쓰지 않았는지: 편집한 본문이 그대로 남아 있다.
		const res = await pool.query<{ mdx: string }>(
			`SELECT mdx FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
			[targetId],
		);
		expect(res.rows[0]?.mdx).toBe("운영에서 직접 고친 본문");
	});
});
