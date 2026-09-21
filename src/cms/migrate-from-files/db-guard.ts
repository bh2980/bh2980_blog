import { randomBytes } from "node:crypto";
import type { Pool } from "pg";

/** 이 도구가 만드는 격리 schema 접두사. 운영 schema(public)와 절대 겹치지 않게 한다. */
export const MIGRATION_SCHEMA_PREFIX = "cms_m6_";

export interface MigrationDatabaseTarget {
	url: string;
	schemaName: string;
}

export function assertMigrationSchemaName(schemaName: string): void {
	if (!/^cms_m6_[a-z0-9_]+$/.test(schemaName)) {
		throw new Error(`시험 schema 이름은 ${MIGRATION_SCHEMA_PREFIX}<영숫자> 형식이어야 합니다: ${schemaName}`);
	}
}

/**
 * 마이그레이션 대상 DB를 정한다. 운영 DB 접속을 막기 위해 다음을 강제한다.
 * - `CMS_TEST_DATABASE_URL`만 사용한다(임의 `--url`을 받지 않는다).
 * - `CMS_DATABASE_URL`과 같은 DB를 가리키면 즉시 실패한다.
 * - schema는 `cms_m6_*` 격리 schema만 허용한다.
 *
 * `CMS_DATABASE_URL`이 없으면 비교할 수 없으므로, 실제 보호는 쓰기가 항상 격리 schema로
 * 한정된다는 점(schema-qualified SQL)에 둔다.
 */
export interface MigrationEnv {
	CMS_TEST_DATABASE_URL?: string | undefined;
	CMS_DATABASE_URL?: string | undefined;
	/** 시험 적재를 명시적으로 허용하는 opt-in 스위치. "1"일 때만 쓰기를 허용한다. */
	CMS_MIGRATION_ALLOW?: string | undefined;
}

/** 쓰기 작업은 명시적 opt-in 없이는 실행하지 않는다. */
export function assertMigrationOptIn(env: MigrationEnv = process.env): void {
	if (env.CMS_MIGRATION_ALLOW !== "1") {
		throw new Error("시험 적재는 CMS_MIGRATION_ALLOW=1 로 명시적으로 허용해야 실행됩니다.");
	}
}

/** DSN에서 데이터베이스 이름만 뽑는다. */
export function databaseNameOf(url: string): string | null {
	try {
		const name = new URL(url).pathname.replace(/^\//, "");
		return name.length > 0 ? name : null;
	} catch {
		return null;
	}
}

/** 실제 접속한 DB가 시험 DSN의 DB와 같은지 확인한다. 다르면 DDL 이전에 중단한다. */
export async function assertConnectedToTestDatabase(
	pool: Pool,
	testUrl: string,
): Promise<{ database: string; role: string; isSuperuser: boolean }> {
	const res = await pool.query<{ database: string; role: string; rolsuper: boolean | null }>(
		`SELECT current_database() AS database, current_user AS role,
		        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper`,
	);
	const row = res.rows[0];
	const actual = row?.database ?? "";
	const expected = databaseNameOf(testUrl);
	if (expected !== null && actual !== expected) {
		throw new Error(`연결된 DB(${actual})가 CMS_TEST_DATABASE_URL의 DB(${expected})와 다릅니다. 중단합니다.`);
	}
	return { database: actual, role: row?.role ?? "", isSuperuser: Boolean(row?.rolsuper) };
}

export function resolveMigrationDatabase(options?: {
	schemaName?: string;
	env?: MigrationEnv;
}): MigrationDatabaseTarget {
	const env: MigrationEnv = options?.env ?? process.env;
	const testUrl = env.CMS_TEST_DATABASE_URL?.trim();
	if (!testUrl) {
		throw new Error("CMS_TEST_DATABASE_URL이 필요합니다. 이 도구는 운영 DB에 접속하지 않습니다.");
	}
	const productionUrl = env.CMS_DATABASE_URL?.trim();
	if (productionUrl && sameDatabase(productionUrl, testUrl)) {
		throw new Error("CMS_DATABASE_URL과 CMS_TEST_DATABASE_URL이 같은 DB를 가리킵니다. 시험 DB가 아니므로 중단합니다.");
	}

	const schemaName = options?.schemaName ?? `${MIGRATION_SCHEMA_PREFIX}${randomBytes(4).toString("hex")}`;
	assertMigrationSchemaName(schemaName);

	return { url: testUrl, schemaName };
}

/** 격리 schema가 비어 있는지 확인한다. 이미 쓰인 schema를 덮어쓰지 않는다. */
export async function assertSchemaIsEmpty(pool: Pool, schemaName: string): Promise<void> {
	assertMigrationSchemaName(schemaName);
	const res = await pool.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema = $1`,
		[schemaName],
	);
	const count = Number(res.rows[0]?.count ?? "0");
	if (count > 0) {
		throw new Error(`시험 schema가 비어 있지 않습니다: ${schemaName} (tables=${count})`);
	}
}

/** 격리 schema를 만들고 비어 있는지 확인한다. 존재하지만 비어 있지 않으면 중단한다. */
export async function createMigrationSchema(pool: Pool, schemaName: string): Promise<void> {
	assertMigrationSchemaName(schemaName);
	await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
	await assertSchemaIsEmpty(pool, schemaName);
}

/** 두 DSN이 같은 DB를 가리키는지 본다. 스킴 표기·기본 포트·후행 슬래시 차이를 흡수한다. */
export function sameDatabase(left: string, right: string): boolean {
	const normalize = (value: string): string => {
		try {
			const url = new URL(value);
			const port = url.port === "" ? "5432" : url.port;
			return `${url.hostname.toLowerCase()}:${port}${url.pathname.replace(/\/$/, "")}`;
		} catch {
			return value.trim();
		}
	};
	return normalize(left) === normalize(right);
}
