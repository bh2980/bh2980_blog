import type { Pool } from "pg";
import { databaseNameOf, sameDatabase } from "./db-guard";

/**
 * M9-BE-1: 운영 DB 이관 전용 가드.
 *
 * M6의 시험 적재 경로(`db-guard.ts`)는 `CMS_TEST_DATABASE_URL`과 `cms_m6_*` 격리 schema만
 * 허용한다. 그 보호를 완화하지 않고 운영용 진입점을 따로 둔다. 이 파일은 **쓰기를 하지 않는다**.
 *
 * 이 경로가 스스로 지키는 계약:
 * 1. 명시적 opt-in 없이는 실행하지 않는다(`CMS_MIGRATION_APPLY_PRODUCTION=1`).
 * 2. 시험 DSN과 같은 DB를 가리키면 중단한다(두 경로가 서로를 덮지 않게).
 * 3. 시험 격리 schema(`cms_m6_*`)를 대상으로 삼지 않는다.
 * 4. DDL을 하지 않는다. 필요한 테이블이 이미 있는지 읽기만 해서 확인한다.
 * 5. 슈퍼유저 접속을 거부한다. 공유 DB에 Payload 테이블이 함께 있으므로
 *    이 작업에 슈퍼유저 권한은 필요하지 않고, 실수 시 피해 범위만 커진다.
 */

/** 운영 이관을 명시적으로 허용하는 스위치. 시험용 `CMS_MIGRATION_ALLOW`와 분리한다. */
export const PRODUCTION_APPLY_FLAG = "CMS_MIGRATION_APPLY_PRODUCTION";

/** 시험 격리 schema 접두사. 운영 진입점은 이 접두사를 거부한다. */
const TEST_SCHEMA_PREFIX = "cms_m6_";

export interface ProductionEnv {
	CMS_DATABASE_URL?: string | undefined;
	CMS_TEST_DATABASE_URL?: string | undefined;
	[key: string]: string | undefined;
}

export interface ProductionDatabaseTarget {
	url: string;
	schemaName: string;
}

export function assertProductionOptIn(env: ProductionEnv = process.env): void {
	if (env[PRODUCTION_APPLY_FLAG] !== "1") {
		throw new Error(`운영 이관은 ${PRODUCTION_APPLY_FLAG}=1 로 명시적으로 허용해야 실행됩니다.`);
	}
}

function validateSchemaName(schema: string): void {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
		throw new Error(`schema 이름이 올바르지 않습니다: ${schema}`);
	}
	if (schema.startsWith(TEST_SCHEMA_PREFIX)) {
		throw new Error(
			`운영 진입점은 시험 격리 schema(${TEST_SCHEMA_PREFIX}*)를 대상으로 삼지 않습니다: ${schema}. 시험 적재는 apply를 쓰세요.`,
		);
	}
}

/**
 * 운영 대상 DB와 schema를 정한다. URL은 `CMS_DATABASE_URL`에서만 온다(임의 `--url` 금지).
 * 시험 DSN과 같은 DB면 중단한다 — 그러면 "시험"이라는 라벨이 붙은 경로가 운영을 건드릴 수 있다.
 */
export function resolveProductionDatabase(options?: {
	schemaName?: string;
	env?: ProductionEnv;
}): ProductionDatabaseTarget {
	const env: ProductionEnv = options?.env ?? process.env;
	const url = env.CMS_DATABASE_URL?.trim();
	if (!url) {
		throw new Error("CMS_DATABASE_URL이 필요합니다. 운영 이관은 CMS DB DSN을 요구합니다.");
	}

	const testUrl = env.CMS_TEST_DATABASE_URL?.trim();
	if (testUrl && sameDatabase(testUrl, url)) {
		throw new Error(
			"CMS_DATABASE_URL과 CMS_TEST_DATABASE_URL이 같은 DB를 가리킵니다. 대상을 확인할 수 없으므로 중단합니다.",
		);
	}

	const schemaName = options?.schemaName?.trim() || "public";
	validateSchemaName(schemaName);

	return { url, schemaName };
}

export interface ProductionConnection {
	database: string;
	role: string;
	isSuperuser: boolean;
}

/** 실제 접속한 DB가 DSN의 DB와 같은지, 그리고 슈퍼유저가 아닌지 확인한다. */
export async function assertConnectedToCmsDatabase(pool: Pool, url: string): Promise<ProductionConnection> {
	const res = await pool.query<{ database: string; role: string; rolsuper: boolean | null }>(
		`SELECT current_database() AS database, current_user AS role,
		        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper`,
	);
	const row = res.rows[0];
	const actual = row?.database ?? "";
	const expected = databaseNameOf(url);
	if (expected !== null && actual !== expected) {
		throw new Error(`연결된 DB(${actual})가 CMS_DATABASE_URL의 DB(${expected})와 다릅니다. 중단합니다.`);
	}

	const isSuperuser = Boolean(row?.rolsuper);
	if (isSuperuser) {
		throw new Error(
			`슈퍼유저(${row?.role ?? "?"})로는 운영 이관을 실행하지 않습니다. CMS 테이블에만 권한이 있는 계정을 쓰세요.`,
		);
	}

	return { database: actual, role: row?.role ?? "", isSuperuser };
}

/**
 * 이관이 쓰는 CMS 테이블이 대상 schema에 이미 있는지 **읽기만** 확인한다.
 * 없으면 DDL로 만들지 않고 중단한다 — 운영 스키마는 별도 승인·마이그레이션 절차의 몫이다.
 */
export const REQUIRED_CMS_TABLES = [
	"entries",
	"entry_bodies",
	"content_addresses",
	"entry_references",
	"folders",
	"media_assets",
	"schedules",
	"body_templates",
	"cms_migrations",
] as const;

/**
 * 이 스키마에서 기대하는 마이그레이션 표식. 이관은 DDL을 하지 않으므로,
 * 스키마가 준비됐다는 것은 이 표식이 있다는 뜻이다.
 */
export const REQUIRED_MIGRATIONS = ["seed_initial_body_templates"] as const;

export async function assertCmsSchemaReady(pool: Pool, schemaName: string): Promise<string[]> {
	const res = await pool.query<{ table_name: string }>(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
		[schemaName],
	);
	const present = new Set(res.rows.map((row) => row.table_name));
	const missing = REQUIRED_CMS_TABLES.filter((table) => !present.has(table));

	if (missing.length > 0) {
		throw new Error(
			`대상 schema(${schemaName})에 CMS 테이블 ${missing.length}개가 없습니다: ${missing.join(", ")}. ` +
				"이 경로는 DDL을 하지 않습니다. 먼저 승인된 마이그레이션 절차로 스키마를 준비하세요.",
		);
	}

	// 테이블 이름만 보면 버전을 알 수 없다. 마이그레이션 표식까지 읽기만 해서 확인한다.
	const migrations = await pool.query<{ name: string }>(`SELECT name FROM "${schemaName}".cms_migrations`);
	const applied = new Set(migrations.rows.map((row) => row.name));
	const missingMigrations = REQUIRED_MIGRATIONS.filter((name) => !applied.has(name));

	if (missingMigrations.length > 0) {
		throw new Error(
			`대상 schema(${schemaName})에 기대하는 마이그레이션 표식이 없습니다: ${missingMigrations.join(", ")}. ` +
				`적용된 표식: ${[...applied].sort().join(", ") || "(없음)"}`,
		);
	}

	return [...present].sort();
}

export interface ProductionTargetInspection {
	database: string;
	role: string;
	schemaName: string;
	entryCounts: { collection: string; status: string; count: number }[];
	addressCounts: { type: string; count: number }[];
	mediaAssetCount: number;
	folderCount: number;
	scheduleCount: number;
	migrations: string[];
	/** 기존 항목이 이미 점유한 working slug. 이관 계획의 slug와 겹치면 중단해야 한다. */
	existingWorkingSlugs: string[];
	/** 공유 DB에 함께 있는 비 CMS 테이블(예: Payload). 우리가 건드리지 않는 대상임을 증명한다. */
	foreignTables: string[];
}

/**
 * 읽기 전용 대상 조사. 트랜잭션을 `READ ONLY`로 열어 이 함수가 쓰기를 할 수 없음을 강제한다.
 * 승인 요청에 붙일 증거와 이관 후 대조에 같은 함수를 쓴다.
 */
export async function inspectProductionDatabase(pool: Pool, schemaName: string): Promise<ProductionTargetInspection> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN TRANSACTION READ ONLY");

		const head = await client.query<{ database: string; role: string }>(
			`SELECT current_database() AS database, current_user AS role`,
		);
		const entries = await client.query<{ collection: string; status: string; count: string }>(
			`SELECT collection, status, COUNT(*)::text AS count FROM "${schemaName}".entries
			 GROUP BY collection, status ORDER BY collection ASC, status ASC`,
		);
		const addresses = await client.query<{ type: string; count: string }>(
			`SELECT type, COUNT(*)::text AS count FROM "${schemaName}".content_addresses GROUP BY type ORDER BY type ASC`,
		);
		const media = await client.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM "${schemaName}".media_assets`,
		);
		const folders = await client.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM "${schemaName}".folders`,
		);
		const schedules = await client.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM "${schemaName}".schedules`,
		);
		const migrations = await client.query<{ name: string }>(
			`SELECT name FROM "${schemaName}".cms_migrations ORDER BY name ASC`,
		);
		const workingSlugs = await client.query<{ working_slug: string | null }>(
			`SELECT working_slug FROM "${schemaName}".entries WHERE working_slug IS NOT NULL ORDER BY working_slug ASC`,
		);
		const tables = await client.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
			[schemaName],
		);

		await client.query("COMMIT");

		const cmsTables = new Set<string>(REQUIRED_CMS_TABLES);

		return {
			database: head.rows[0]?.database ?? "",
			role: head.rows[0]?.role ?? "",
			schemaName,
			entryCounts: entries.rows.map((row) => ({
				collection: row.collection,
				status: row.status,
				count: Number(row.count),
			})),
			addressCounts: addresses.rows.map((row) => ({ type: row.type, count: Number(row.count) })),
			mediaAssetCount: Number(media.rows[0]?.count ?? "0"),
			folderCount: Number(folders.rows[0]?.count ?? "0"),
			scheduleCount: Number(schedules.rows[0]?.count ?? "0"),
			migrations: migrations.rows.map((row) => row.name),
			existingWorkingSlugs: workingSlugs.rows
				.map((row) => row.working_slug)
				.filter((slug): slug is string => slug !== null),
			foreignTables: tables.rows
				.map((row) => row.table_name)
				.filter((name) => !cmsTables.has(name) && name !== "user_preferences")
				.sort(),
		};
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}
