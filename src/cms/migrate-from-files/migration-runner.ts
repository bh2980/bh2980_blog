import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createContentStore, migrateContentStore } from "@/cms/adapters/postgres/content-store";
import { assertSchemaIsEmpty, resolveMigrationDatabase } from "./db-guard";
import { buildImportPlan, type ImportPlan } from "./import-plan";
import { type InspectionReport, inspectLegacyCorpus } from "./inspect";
import { readLegacyCorpus } from "./legacy-parser";

export interface ImportReportEntry {
	collection: string;
	slug: string | null;
	id: string;
	outcome: "imported" | "skipped";
}

export interface ImportReport {
	formatVersion: number;
	startedAt: string;
	finishedAt: string;
	root: string;
	schemaName: string;
	dryRun: boolean;
	counts: ImportPlan["counts"];
	blocking: ImportPlan["blocking"];
	warnings: ImportPlan["warnings"];
	firstRun: { imported: number; skipped: number; items: ImportReportEntry[] } | null;
	secondRun: { imported: number; skipped: number } | null;
	verification: {
		entryCount: number;
		publishedEntryCount: number;
		draftEntryCount: number;
		slugSetsMatch: boolean;
		missingSlugs: string[];
		unexpectedSlugs: string[];
	} | null;
	notes: string[];
}

const runId = () => new Date().toISOString().replace(/[:.]/g, "-");

export const writeJsonReport = (filePath: string, value: unknown): void => {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const defaultReportPath = (root: string, run: string): string =>
	path.join(root, "artifacts", "cms", "m6", run, "import-report.json");

export interface InspectOptions {
	root: string;
	out?: string;
}

/** 쓰기 없는 순수 검사. 결과를 콘솔 요약과 JSON 파일로 남긴다. */
export function runInspect(options: InspectOptions): { report: InspectionReport; outputPath: string | null } {
	const report = inspectLegacyCorpus(options.root);
	const summary = [
		`posts=${report.counts.posts} memos=${report.counts.memos} categories=${report.counts.categories} tags=${report.counts.tags} collections=${report.counts.collections}`,
		`images=${report.counts.images} (missing=${report.counts.imagesMissing}, emptyAlt=${report.counts.imagesEmptyAlt})`,
		`codeFences=${report.counts.codeFences} tables=${report.counts.tables} blockMath=${report.counts.blockMath}`,
		`blocking=${report.issues.blocking.length} warnings=${report.issues.warnings.length}`,
	];
	console.log("[inspect] 읽기 전용 검사");
	for (const line of summary) console.log(`  ${line}`);
	for (const issue of report.issues.blocking) console.log(`  BLOCKING ${issue.code}: ${issue.path} — ${issue.message}`);

	const outputPath = options.out ?? defaultReportPath(options.root, runId());
	writeJsonReport(outputPath, report);
	console.log(`  보고서: ${outputPath}`);
	return { report, outputPath };
}

export interface ApplyOptions {
	root: string;
	schemaName?: string;
	out?: string;
	/** true면 DB에 쓰지 않고 계획까지만 세운다. */
	dryRun?: boolean;
}

/**
 * 시험 DB 격리 schema에 기존 콘텐츠를 적재한다.
 * - 운영 DB 접속은 `resolveMigrationDatabase`가 막는다.
 * - 전체가 한 트랜잭션이며, 두 번째 실행은 전부 skip이어야 한다(멱등성 확인).
 */
export async function runApply(options: ApplyOptions): Promise<{ report: ImportReport; outputPath: string }> {
	const startedAt = new Date().toISOString();
	const corpus = readLegacyCorpus(options.root);
	const plan = await buildImportPlan(corpus);

	if (plan.blocking.length > 0) {
		throw new Error(
			`이전 차단 이슈 ${plan.blocking.length}건을 먼저 해결해야 합니다: ${plan.blocking
				.map((issue) => `${issue.code}(${issue.path})`)
				.join(", ")}`,
		);
	}

	const dryRun = options.dryRun ?? false;
	let report: ImportReport = {
		formatVersion: 1,
		startedAt,
		finishedAt: new Date().toISOString(),
		root: options.root,
		schemaName: dryRun ? "" : (options.schemaName ?? ""),
		dryRun,
		counts: plan.counts,
		blocking: plan.blocking,
		warnings: plan.warnings,
		firstRun: null,
		secondRun: null,
		verification: null,
		notes: [
			"importedAt 같은 실행 provenance는 저장하지 않고 이 보고서에만 기록한다.",
			"이미지 바이너리는 옮기지 않는다. R2 복사는 별도 절차다.",
		],
	};

	if (!dryRun) {
		const target = resolveMigrationDatabase({ schemaName: options.schemaName });
		const pool = new Pool({ connectionString: target.url });
		try {
			await assertSchemaIsEmpty(pool, target.schemaName);
			await migrateContentStore(pool, { schema: target.schemaName });
			const store = createContentStore(pool, { schema: target.schemaName });

			const first = await store.importEntries(plan.items);
			const second = await store.importEntries(plan.items);
			const snapshot = await store.readExportSnapshot();

			const expectedSlugs = new Set(
				plan.items
					.filter((item) => item.slug !== null && item.status === "published")
					.map((item) => item.slug as string),
			);
			const actualPublished = snapshot.entries.filter((entry) => entry.status === "published");
			const actualSlugs = new Set(
				actualPublished.map((entry) => entry.publishedSlug).filter((slug): slug is string => slug !== null),
			);

			report = {
				...report,
				schemaName: target.schemaName,
				firstRun: { imported: first.imported, skipped: first.skipped, items: first.items },
				secondRun: { imported: second.imported, skipped: second.skipped },
				verification: {
					entryCount: snapshot.entries.length,
					publishedEntryCount: actualPublished.length,
					draftEntryCount: snapshot.entries.filter((entry) => entry.status === "draft").length,
					slugSetsMatch:
						expectedSlugs.size === actualSlugs.size && [...expectedSlugs].every((slug) => actualSlugs.has(slug)),
					missingSlugs: [...expectedSlugs].filter((slug) => !actualSlugs.has(slug)).sort(),
					unexpectedSlugs: [...actualSlugs].filter((slug) => !expectedSlugs.has(slug)).sort(),
				},
				finishedAt: new Date().toISOString(),
			};
		} finally {
			await pool.end();
		}
	}

	const outputPath = options.out ?? defaultReportPath(options.root, runId());
	writeJsonReport(outputPath, report);

	console.log(`[apply${dryRun ? ":dry-run" : ""}] 계획 ${plan.counts.items}건`);
	if (report.firstRun) {
		console.log(`  1차 적재: imported=${report.firstRun.imported} skipped=${report.firstRun.skipped}`);
	}
	if (report.secondRun) {
		console.log(`  2차 재실행(멱등성): imported=${report.secondRun.imported} skipped=${report.secondRun.skipped}`);
	}
	if (report.verification) {
		console.log(
			`  검증: entries=${report.verification.entryCount} published=${report.verification.publishedEntryCount} draft=${report.verification.draftEntryCount} slugSetsMatch=${report.verification.slugSetsMatch}`,
		);
	}
	console.log(`  schema: ${report.schemaName || "(dry-run)"}`);
	console.log(`  보고서: ${outputPath}`);

	return { report, outputPath };
}
