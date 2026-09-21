import { describe, expect, it, vi } from "vitest";
import {
	assertMigrationOptIn,
	assertMigrationSchemaName,
	databaseNameOf,
	resolveMigrationDatabase,
	sameDatabase,
} from "@/cms/migrate-from-files/db-guard";

describe("migration database guard", () => {
	it("CMS_TEST_DATABASE_URL이 없으면 실패한다", () => {
		expect(() => resolveMigrationDatabase({ env: {} })).toThrow(/CMS_TEST_DATABASE_URL/);
	});

	it("운영 URL과 시험 URL이 같으면 중단한다", () => {
		expect(() =>
			resolveMigrationDatabase({
				env: { CMS_DATABASE_URL: "postgres://same/db", CMS_TEST_DATABASE_URL: "postgres://same/db" },
			}),
		).toThrow(/시험 DB가 아니므로 중단/);
	});

	it("시험 URL만 있으면 통과하고 cms_m6_ 접두사 schema를 만든다", () => {
		const target = resolveMigrationDatabase({ env: { CMS_TEST_DATABASE_URL: "postgres://test/db" } });
		expect(target.url).toBe("postgres://test/db");
		expect(target.schemaName).toMatch(/^cms_m6_[0-9a-f]{8}$/);
	});

	it("격리 schema 접두사가 아니면 거부한다", () => {
		expect(() => assertMigrationSchemaName("public")).toThrow(/cms_m6_/);
		expect(() =>
			resolveMigrationDatabase({
				env: { CMS_TEST_DATABASE_URL: "postgres://test/db" },
				schemaName: "public",
			}),
		).toThrow(/cms_m6_/);
	});

	it("schema를 명시하면 그대로 쓴다", () => {
		const target = resolveMigrationDatabase({
			env: { CMS_TEST_DATABASE_URL: "postgres://test/db" },
			schemaName: "cms_m6_rehearsal",
		});
		expect(target.schemaName).toBe("cms_m6_rehearsal");
	});

	it("process.env를 기본값으로 쓴다", () => {
		vi.stubEnv("CMS_TEST_DATABASE_URL", "postgres://from-env/db");
		vi.stubEnv("CMS_DATABASE_URL", "postgres://prod/db");
		try {
			expect(resolveMigrationDatabase().url).toBe("postgres://from-env/db");
		} finally {
			vi.unstubAllEnvs();
		}
	});
	it("명시적 opt-in 없이는 쓰기를 허용하지 않는다", () => {
		expect(() => assertMigrationOptIn({})).toThrow(/CMS_MIGRATION_ALLOW=1/);
		expect(() => assertMigrationOptIn({ CMS_MIGRATION_ALLOW: "0" })).toThrow();
		expect(() => assertMigrationOptIn({ CMS_MIGRATION_ALLOW: "1" })).not.toThrow();
	});

	it("DSN에서 DB 이름을 뽑고 기본 포트·후행 슬래시 차이를 흡수한다", () => {
		expect(databaseNameOf("postgres://user:pw@localhost:5432/cms_test")).toBe("cms_test");
		expect(databaseNameOf("not a url")).toBeNull();
		expect(sameDatabase("postgres://a@localhost/db", "postgres://b@localhost:5432/db")).toBe(true);
		expect(sameDatabase("postgres://a@localhost/db/", "postgres://a@localhost/db")).toBe(true);
		expect(sameDatabase("postgres://a@localhost/db", "postgres://a@localhost/other")).toBe(false);
	});
});
