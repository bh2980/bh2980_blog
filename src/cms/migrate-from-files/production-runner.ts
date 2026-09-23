import { createHash } from "node:crypto";
import path from "node:path";
import type { Pool } from "pg";
import { createContentStore, type ImportEntryItem } from "@/cms/adapters/postgres/content-store";
import type { ImportPlan } from "./import-plan";
import { buildImportPlan } from "./import-plan";
import { readLegacyCorpus } from "./legacy-parser";
import { writeJsonReport } from "./migration-runner";
import type { ProductionConnection } from "./production-guard";

/**
 * M9-BE-1: 운영 DB 이관 실행.
 *
 * 시험 경로(`runApply`)와 다른 점:
 * - schema를 만들지도, `migrateContentStore()`를 실행하지도 않는다(DDL 없음).
 * - 멱등성 확인을 위해 두 번 적재하지 않는다. 운영 첫 실행은 **한 번**만 쓴다.
 * - 쓰기 전에 읽기 전용 사전조사를 해서 대상이 깨끗한지 확인하고, 아니면 쓰지 않고 중단한다.
 *
 * 안전 성질은 `ContentStore.importEntries()`가 이미 보장한다:
 * - 전체가 단일 트랜잭션이다(하나라도 충돌하면 전부 롤백).
 * - 같은 ID·같은 내용이면 skip하고, 내용이 다르면 **덮어쓰지 않고** conflict로 중단한다.
 * 그래서 재실행이 기존 편집을 지우지 않는다.
 */

export interface ProductionTargetState {
	entryCount: number;
	publishedCount: number;
	draftCount: number;
	/** 이미 존재하는 계획 항목 ID. 비어 있어야 깨끗한 첫 적재다. */
	existingEntryIds: string[];
	/** 계획한 slug를 이미 다른 항목이 점유한 경우(주소 행 또는 working_slug). 비어 있어야 한다. */
	collidingSlugs: string[];
	/** 대상에 있는 계획 밖 항목 수. 이관은 이들을 건드리지 않지만, 섞는 결정은 명시적이어야 한다. */
	foreignEntryCount: number;
}

export interface ProductionApplyReport {
	formatVersion: number;
	mode: "production";
	startedAt: string;
	finishedAt: string;
	root: string;
	schemaName: string;
	connection: ProductionConnection | null;
	planDigest: string;
	expectedDigest: string | null;
	counts: ImportPlan["counts"];
	blocking: ImportPlan["blocking"];
	warnings: ImportPlan["warnings"];
	targetState: ProductionTargetState | null;
	apply: { imported: number; skipped: number; items: ProductionApplyReportItem[] } | null;
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

export interface ProductionApplyReportItem {
	collection: string;
	slug: string | null;
	id: string;
	outcome: "imported" | "skipped";
}

const runId = () => new Date().toISOString().replace(/[:.]/g, "-");

export const defaultProductionReportPath = (root: string, run: string): string =>
	path.join(root, "artifacts", "cms", "m9", run, "production-import-report.json");

/**
 * 원본 스냅샷 지문. 같은 원본·같은 계획으로 실행했는지 사후에 증명한다.
 * 항목 순서에 흔들리지 않도록 정렬한 문자열을 해시한다.
 */
export function planDigest(plan: ImportPlan): string {
	const lines = plan.items
		.map((item: ImportEntryItem) =>
			[
				item.id,
				item.collection,
				item.status,
				item.slug ?? "",
				item.folderId ?? "",
				item.working.contentHash,
				item.published?.contentHash ?? "",
			].join("|"),
		)
		.sort();

	return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

/** 쓰기 없는 사전조사. 대상 schema가 깨끗한지 읽기만 해서 확인한다. */
export async function inspectProductionTarget(pool: Pool, schemaName: string, plan: ImportPlan) {
	const totals = await pool.query<{ total: string; published: string; draft: string }>(
		`SELECT COUNT(*)::text AS total,
		        COUNT(*) FILTER (WHERE status = 'published')::text AS published,
		        COUNT(*) FILTER (WHERE status = 'draft')::text AS draft
		 FROM "${schemaName}".entries`,
	);

	const ids = plan.items.map((item) => item.id);
	const existing = await pool.query<{ id: string }>(
		`SELECT id FROM "${schemaName}".entries WHERE id = ANY($1::uuid[])`,
		[ids],
	);

	const plannedSlugs = plan.items
		.map((item) => item.slug)
		.filter((slug): slug is string => slug !== null && slug.length > 0);
	// 주소 테이블과 working_slug를 둘 다 본다. 한쪽만 보면 점유된 slug를 놓칠 수 있다.
	const collisions = await pool.query<{ slug: string }>(
		`SELECT slug FROM "${schemaName}".content_addresses WHERE slug = ANY($1::text[])
		 UNION
		 SELECT working_slug AS slug FROM "${schemaName}".entries WHERE working_slug = ANY($1::text[])`,
		[plannedSlugs],
	);
	// 대상에 있는 계획 밖 항목. 이관은 이들을 건드리지 않는다.
	const foreign = await pool.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM "${schemaName}".entries WHERE NOT (id = ANY($1::uuid[]))`,
		[ids],
	);

	const row = totals.rows[0];

	return {
		entryCount: Number(row?.total ?? "0"),
		publishedCount: Number(row?.published ?? "0"),
		draftCount: Number(row?.draft ?? "0"),
		existingEntryIds: existing.rows.map((entry) => entry.id).sort(),
		collidingSlugs: collisions.rows.map((entry) => entry.slug).sort(),
		foreignEntryCount: Number(foreign.rows[0]?.count ?? "0"),
	} satisfies ProductionTargetState;
}

/**
 * 쓰기 없는 운영 사전 계획. 승인받을 원본 지문과 예상 건수를 여기서 뽑는다.
 * DB에 접속하지 않으므로 `CMS_DATABASE_URL`도 필요 없다.
 */
export async function planProductionApply(options: { root: string; out?: string }): Promise<{
	report: ProductionApplyReport;
	outputPath: string;
}> {
	const corpus = readLegacyCorpus(options.root);
	const plan = await buildImportPlan(corpus);

	if (plan.blocking.length > 0) {
		throw new Error(
			`이전 차단 이슈 ${plan.blocking.length}건: ${plan.blocking.map((issue) => `${issue.code}(${issue.path})`).join(", ")}`,
		);
	}

	const digest = planDigest(plan);
	const report: ProductionApplyReport = {
		formatVersion: 1,
		mode: "production",
		startedAt: new Date().toISOString(),
		finishedAt: new Date().toISOString(),
		root: options.root,
		schemaName: "(dry-run)",
		connection: null,
		planDigest: digest,
		expectedDigest: null,
		counts: plan.counts,
		blocking: plan.blocking,
		warnings: plan.warnings,
		targetState: null,
		apply: null,
		verification: null,
		notes: [
			"dry-run: DB에 접속하지 않았다. 실제 적재는 이 지문을 승인한 뒤 apply-production으로 실행한다.",
			"apply-production 실행 시 이 지문을 --expect-digest로 넘기면 원본이 바뀌었을 때 중단한다.",
		],
	};

	const outputPath = options.out ?? defaultProductionReportPath(options.root, runId());
	writeJsonReport(outputPath, report);

	return { report, outputPath };
}

export interface ProductionApplyOptions {
	root: string;
	pool: Pool;
	schemaName: string;
	connection?: ProductionConnection;
	/** **필수.** 사전조사/dry-run 보고서에서 읽은 원본 지문. 다르면 무쓰기 중단. */
	expectedDigest: string;
	/** **필수.** 계획 항목 수. 지문과 함께 "승인된 원본"을 고정한다. */
	expectedItems: number;
	/** **필수.** 실행 전 관찰한 대상 `entries` 수. 사전조사와 다르면 무쓰기 중단. */
	expectedExistingEntries: number;
	/**
	 * 기본 false. true여도 내용을 덮어쓰지 않으며(`importEntries`가 충돌로 중단),
	 * 계획 밖 항목이 있으면 여전히 중단한다.
	 */
	allowExistingTarget?: boolean;
	out?: string;
}

export async function runProductionApply(
	options: ProductionApplyOptions,
): Promise<{ report: ProductionApplyReport; outputPath: string }> {
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

	// 승인된 원본을 강제한다. 이 두 값은 승인된 보고서에서 그대로 옮겨 적어야 한다.
	if (!options.expectedDigest?.trim()) {
		throw new Error("expectedDigest가 필요합니다. dry-run 보고서의 planDigest를 그대로 넘기세요.");
	}
	const digest = planDigest(plan);
	if (options.expectedDigest !== digest) {
		throw new Error(
			`원본 지문이 승인된 값과 다릅니다. 실행하지 않습니다.\n  승인: ${options.expectedDigest}\n  현재: ${digest}`,
		);
	}
	if (!Number.isInteger(options.expectedItems) || options.expectedItems !== plan.counts.items) {
		throw new Error(
			`예상 건수가 계획과 다릅니다. 실행하지 않습니다. 승인: ${options.expectedItems} / 현재: ${plan.counts.items}`,
		);
	}

	// 쓰기 전에 읽기만 한다. 대상이 깨끗하지 않으면 여기서 멈춘다.
	const targetState = await inspectProductionTarget(options.pool, options.schemaName, plan);

	// 관찰한 대상이 사전조사와 다르면 누가 이미 쓴 것이다. 계산을 멈추고 사람이 다시 본다.
	if (
		!Number.isInteger(options.expectedExistingEntries) ||
		options.expectedExistingEntries !== targetState.entryCount
	) {
		throw new Error(
			[
				"대상 `entries` 수가 사전조사와 다릅니다. 쓰지 않고 중단합니다.",
				`  사전조사: ${options.expectedExistingEntries}건 / 현재: ${targetState.entryCount}건`,
				"  inspect-target으로 다시 관찰하고 승인 범위를 재확인하세요.",
			].join("\n"),
		);
	}

	// 계획 밖 항목이 있는 대상에 섞어 넣지 않는다. 이건 별도 판단이 필요한 변경이다.
	if (targetState.foreignEntryCount > 0) {
		throw new Error(
			[
				`대상에 계획 밖 항목이 ${targetState.foreignEntryCount}건 있어 쓰지 않고 중단합니다.`,
				"  이관은 기존 항목을 건드리지 않으므로 기술적으로는 가능하지만, 빈 DB가 아닌 곳에",
				"  콘텐츠를 섞는 결정은 별도 승인이 필요합니다. 기존 항목을 정리한 뒤 다시 실행하세요.",
			].join("\n"),
		);
	}

	if (
		!options.allowExistingTarget &&
		(targetState.existingEntryIds.length > 0 || targetState.collidingSlugs.length > 0)
	) {
		throw new Error(
			[
				"대상이 깨끗하지 않아 쓰지 않고 중단합니다.",
				`  이미 있는 계획 항목: ${targetState.existingEntryIds.length}건`,
				`  점유된 slug: ${targetState.collidingSlugs.length}건 ${targetState.collidingSlugs.slice(0, 5).join(", ")}`,
				"  의도된 재실행이면 allowExistingTarget을 켜세요(같은 내용은 skip, 다른 내용은 충돌로 중단).",
			].join("\n"),
		);
	}

	const store = createContentStore(options.pool, { schema: options.schemaName });
	const applied = await store.importEntries(plan.items);
	const snapshot = await store.readExportSnapshot();

	const expectedSlugs = new Set(
		plan.items.filter((item) => item.slug !== null && item.status === "published").map((item) => item.slug as string),
	);
	const actualPublished = snapshot.entries.filter((entry) => entry.status === "published");
	const actualSlugs = new Set(
		actualPublished.map((entry) => entry.publishedSlug).filter((slug): slug is string => slug !== null),
	);

	const report: ProductionApplyReport = {
		formatVersion: 1,
		mode: "production",
		startedAt,
		finishedAt: new Date().toISOString(),
		root: options.root,
		schemaName: options.schemaName,
		connection: options.connection ?? null,
		planDigest: digest,
		expectedDigest: options.expectedDigest,
		counts: plan.counts,
		blocking: plan.blocking,
		warnings: plan.warnings,
		targetState,
		apply: { imported: applied.imported, skipped: applied.skipped, items: applied.items },
		verification: {
			entryCount: snapshot.entries.length,
			publishedEntryCount: actualPublished.length,
			draftEntryCount: snapshot.entries.filter((entry) => entry.status === "draft").length,
			slugSetsMatch:
				expectedSlugs.size === actualSlugs.size && [...expectedSlugs].every((slug) => actualSlugs.has(slug)),
			missingSlugs: [...expectedSlugs].filter((slug) => !actualSlugs.has(slug)).sort(),
			unexpectedSlugs: [...actualSlugs].filter((slug) => !expectedSlugs.has(slug)).sort(),
		},
		notes: [
			"이미지 바이너리는 옮기지 않는다. 기존 /assets 경로를 그대로 쓴다(M9 O1 결정).",
			"DDL을 실행하지 않는다. 대상 스키마는 승인된 절차로 미리 준비돼 있어야 한다.",
			"재실행은 같은 내용만 skip하고, 내용이 다르면 덮어쓰지 않고 충돌로 중단한다.",
		],
	};

	const outputPath = options.out ?? defaultProductionReportPath(options.root, runId());
	writeJsonReport(outputPath, report);

	// 적재는 이미 커밋됐다(롤백 불가). 검증이 틀렸다면 조용히 성공으로 끝내지 않는다:
	// 호출자가 0이 아닌 종료를 받아야 플래그를 켜지 않는다.
	const verification = report.verification;
	if (
		verification &&
		(!verification.slugSetsMatch ||
			verification.missingSlugs.length > 0 ||
			verification.unexpectedSlugs.length > 0 ||
			verification.entryCount !== targetState.entryCount + applied.imported)
	) {
		throw new Error(
			[
				"적재 후 검증이 실패했습니다. **공개 저장소 플래그를 바꾸지 마세요.**",
				`  slugSetsMatch=${verification.slugSetsMatch}`,
				`  missingSlugs=${verification.missingSlugs.length} unexpectedSlugs=${verification.unexpectedSlugs.length}`,
				`  entries=${verification.entryCount} (사전 ${targetState.entryCount} + 적재 ${applied.imported})`,
				`  보고서: ${outputPath}`,
			].join("\n"),
		);
	}

	return { report, outputPath };
}
