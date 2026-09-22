import path from "node:path";
import { Pool } from "pg";
import { runApply, runInspect, writeJsonReport } from "./migration-runner";
import {
	assertCmsSchemaReady,
	assertConnectedToCmsDatabase,
	assertProductionOptIn,
	inspectProductionDatabase,
	PRODUCTION_APPLY_FLAG,
	resolveProductionDatabase,
} from "./production-guard";
import { planProductionApply, runProductionApply } from "./production-runner";

const args = process.argv.slice(2);
const command = args[0] ?? "inspect";

const readFlag = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	if (index < 0) return undefined;
	const value = args[index + 1];
	return value && !value.startsWith("--") ? value : undefined;
};

const root = path.resolve(readFlag("root") ?? process.cwd());
const out = readFlag("out");
const schemaName = readFlag("schema");

async function main(): Promise<void> {
	if (command === "inspect") {
		runInspect({ root, ...(out ? { out } : {}) });
		return;
	}
	if (command === "apply") {
		await runApply({
			root,
			dryRun: args.includes("--dry-run"),
			reuseSchema: args.includes("--reuse"),
			...(out ? { out } : {}),
			...(schemaName ? { schemaName } : {}),
		});
		return;
	}

	// 읽기 전용 대상 조사. 쓰기가 불가능하도록 READ ONLY 트랜잭션으로만 실행한다.
	if (command === "inspect-target") {
		const target = resolveProductionDatabase({ ...(schemaName ? { schemaName } : {}) });
		const pool = new Pool({ connectionString: target.url });
		try {
			const connection = await assertConnectedToCmsDatabase(pool, target.url);
			// 이관에 필요한 CMS 테이블이 실제로 있는지 먼저 확인한다(DDL 없이).
			await assertCmsSchemaReady(pool, target.schemaName);
			const inspection = await inspectProductionDatabase(pool, target.schemaName);
			const output = { ...inspection, isSuperuser: connection.isSuperuser, schemaReady: true, readOnly: true };
			console.log(JSON.stringify(output, null, 2));
			if (out) {
				writeJsonReport(out, output);
				console.error(`보고서: ${out}`);
			}
		} finally {
			await pool.end();
		}
		return;
	}

	// M9-BE-1: 운영 DB 이관. 시험 경로와 완전히 분리되어 있고 opt-in이 따로다.
	if (command === "apply-production") {
		if (args.includes("--dry-run")) {
			const { report, outputPath } = await planProductionApply({ root, ...(out ? { out } : {}) });
			console.log("[apply-production:dry-run] DB에 접속하지 않았습니다.");
			console.log(
				`  계획 ${report.counts.items}건 (published=${report.counts.published} draft=${report.counts.draft})`,
			);
			console.log(`  원본 지문: ${report.planDigest}`);
			console.log(`  보고서: ${outputPath}`);
			return;
		}

		assertProductionOptIn();
		const target = resolveProductionDatabase({ ...(schemaName ? { schemaName } : {}) });
		const expectedDigest = readFlag("expect-digest");
		const pool = new Pool({ connectionString: target.url });
		try {
			const connection = await assertConnectedToCmsDatabase(pool, target.url);
			await assertCmsSchemaReady(pool, target.schemaName);
			const { report, outputPath } = await runProductionApply({
				root,
				pool,
				schemaName: target.schemaName,
				connection,
				...(expectedDigest ? { expectedDigest } : {}),
				...(args.includes("--allow-existing") ? { allowExistingTarget: true } : {}),
				...(out ? { out } : {}),
			});
			console.log(`[apply-production] schema=${report.schemaName} db=${connection.database} role=${connection.role}`);
			console.log(`  원본 지문: ${report.planDigest}`);
			console.log(`  적재: imported=${report.apply?.imported ?? 0} skipped=${report.apply?.skipped ?? 0}`);
			if (report.verification) {
				console.log(
					`  검증: entries=${report.verification.entryCount} published=${report.verification.publishedEntryCount} draft=${report.verification.draftEntryCount} slugSetsMatch=${report.verification.slugSetsMatch}`,
				);
			}
			console.log(`  보고서: ${outputPath}`);
		} finally {
			await pool.end();
		}
		return;
	}

	console.error(
		[
			"사용법:",
			"  tsx src/cms/migrate-from-files/cli.ts inspect [--out <path>] [--root <dir>]",
			"  tsx src/cms/migrate-from-files/cli.ts apply [--dry-run] [--reuse] [--schema cms_m6_xxx] [--out <path>]",
			"  tsx src/cms/migrate-from-files/cli.ts apply-production --dry-run [--out <path>]",
			"  tsx src/cms/migrate-from-files/cli.ts apply-production [--schema public] [--expect-digest <sha256>] [--allow-existing] [--out <path>]",
			"  tsx src/cms/migrate-from-files/cli.ts inspect-target [--schema public] [--out <path>]",
			"",
			"apply는 CMS_TEST_DATABASE_URL과 cms_m6_* 격리 schema만 사용하고, CMS_MIGRATION_ALLOW=1 일 때만 실행한다.",
			`apply-production은 CMS_DATABASE_URL만 사용하고 DDL을 하지 않으며, ${PRODUCTION_APPLY_FLAG}=1 일 때만 실행한다.`,
			"inspect-target은 READ ONLY 트랜잭션이라 쓰기를 할 수 없다.",
			"사용자 운영 이관 승인을 받은 뒤에만 실행한다.",
		].join("\n"),
	);
	process.exit(1);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
