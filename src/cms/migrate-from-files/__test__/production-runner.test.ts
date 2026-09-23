import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
 * 실제 운영 대상은 `public`이지만 여기서는 성질만 검증한다:
 * DDL 없음 / 승인된 원본·대상이 아니면 무쓰기 중단 / 계획 밖 항목이 있는 대상에는 섞지 않음 /
 * 같은 내용은 skip / 내용이 다르면 **덮어쓰지 않고** 중단 / 적재 후 검증 실패는 조용히 성공하지 않음.
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
			expect(report.outcome).toBe("dry_run");
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

	/** 승인된 보고서에서 옮겨 적는 값을 그대로 흉내 낸다. */
	const applyOptions = async (extra: Record<string, unknown> = {}) => {
		const plan = await buildImportPlan(readLegacyCorpus(fixture.root));

		return {
			root: fixture.root,
			pool,
			schemaName,
			out: path.join(outDir, `${schemaName}-${Math.random().toString(16).slice(2)}.json`),
			expectedDigest: planDigest(plan),
			expectedItems: plan.counts.items,
			expectedExistingEntries: 0,
			...extra,
		};
	};

	const entriesOf = async () => {
		const res = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "${schemaName}".entries`);
		return Number(res.rows[0]?.count ?? "0");
	};

	const insertForeignEntry = async () => {
		await pool.query(
			`INSERT INTO "${schemaName}".entries (id, collection, status, version, created_at, updated_at)
			 VALUES (gen_random_uuid(), 'post', 'draft', 1, now(), now())`,
		);
	};

	it("깨끗한 대상에 한 번 적재하고 검증까지 통과한다", async () => {
		const plan = await buildImportPlan(readLegacyCorpus(fixture.root));

		const { report } = await runProductionApply(await applyOptions());

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
		await expect(runProductionApply(await applyOptions({ expectedDigest: "0".repeat(64) }))).rejects.toThrow(
			/원본 지문이 승인된 값과 다릅니다/,
		);

		expect(await entriesOf()).toBe(0);
	});

	it("지문·건수 인자가 없으면 쓰지 않고 중단한다", async () => {
		await expect(
			runProductionApply(await applyOptions({ expectedDigest: "", expectedItems: 0, expectedExistingEntries: 0 })),
		).rejects.toThrow(/expectedDigest/);
		await expect(runProductionApply(await applyOptions({ expectedItems: 999 }))).rejects.toThrow(/예상 건수가 계획과/);

		expect(await entriesOf()).toBe(0);
	});

	it("사전조사와 대상 `entries` 수가 다르면 쓰지 않고 중단한다", async () => {
		await expect(runProductionApply(await applyOptions({ expectedExistingEntries: 3 }))).rejects.toThrow(
			/사전조사와 다릅니다/,
		);

		expect(await entriesOf()).toBe(0);
	});

	it("계획 밖 항목이 있는 대상에는 섞어 넣지 않는다", async () => {
		// M7 보고서의 운영 DB처럼 주소도 working_slug도 없는 남의 초안이 있는 경우를 흉내 낸다.
		await insertForeignEntry();
		expect(await entriesOf()).toBe(1);

		await expect(runProductionApply(await applyOptions({ expectedExistingEntries: 1 }))).rejects.toThrow(
			/계획 밖 항목/,
		);

		// 남의 초안만 그대로 남아 있어야 한다.
		expect(await entriesOf()).toBe(1);
	});

	it("이미 적재된 대상은 기본값으로 다시 쓰지 않는다", async () => {
		const first = await runProductionApply(await applyOptions());
		const imported = first.report.apply?.imported ?? 0;

		await expect(runProductionApply(await applyOptions({ expectedExistingEntries: imported }))).rejects.toThrow(
			/깨끗하지 않아/,
		);
	});

	it("`allow-existing`를 켜도 계획 밖 항목이 있으면 쓰지 않는다", async () => {
		// R2 지적: 약한 검사(깨끗함)를 끄는 플래그가 강한 검사(계획 밖 항목)까지 끄면 안 된다.
		await insertForeignEntry();

		await expect(
			runProductionApply(await applyOptions({ allowExistingTarget: true, expectedExistingEntries: 1 })),
		).rejects.toThrow(/계획 밖 항목/);

		// 남의 초안 1건만 그대로다. 계획 항목은 하나도 들어가지 않았다.
		expect(await entriesOf()).toBe(1);
	});

	it("성공한 적재 보고서에 결과 표식이 남는다", async () => {
		const first = await runProductionApply(await applyOptions());

		// JSON만 보고 성공 적재인지 판단할 수 있어야 한다.
		expect(first.report.outcome).toBe("verified");
		const written = JSON.parse(readFileSync(first.outputPath, "utf8"));
		expect(written.outcome).toBe("verified");
	});

	it("의도된 재실행은 같은 내용을 skip하고 새로 쓰지 않는다", async () => {
		const first = await runProductionApply(await applyOptions());
		const imported = first.report.apply?.imported ?? 0;

		const second = await runProductionApply(
			await applyOptions({ allowExistingTarget: true, expectedExistingEntries: imported }),
		);

		expect(second.report.apply?.imported).toBe(0);
		expect(second.report.apply?.skipped).toBe(imported);
		expect(await entriesOf()).toBe(imported);
	});

	it("대상이 편집돼 내용이 갈리면 덮어쓰지 않고 충돌로 중단한다", async () => {
		const plan = await buildImportPlan(readLegacyCorpus(fixture.root));
		const first = await runProductionApply(await applyOptions());
		const imported = first.report.apply?.imported ?? 0;

		const targetId = plan.items[0]?.id as string;
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = '운영에서 직접 고친 본문', content_hash = 'human-edit'
			 WHERE entry_id = $1 AND state = 'working'`,
			[targetId],
		);

		await expect(
			runProductionApply(await applyOptions({ allowExistingTarget: true, expectedExistingEntries: imported })),
		).rejects.toThrow(/conflict/);

		// 덮어쓰지 않았는지: 편집한 본문이 그대로 남아 있다.
		const res = await pool.query<{ mdx: string }>(
			`SELECT mdx FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
			[targetId],
		);
		expect(res.rows[0]?.mdx).toBe("운영에서 직접 고친 본문");
	});
});
