import { describe, expect, it } from "vitest";
import { CONTENT_REPOSITORY_SOURCES, resolveContentRepositorySource } from "../repositories/source";

describe("공개 조회 저장소 플래그 (M9-BE-3: Keystatic 제거 후 postgres 필수)", () => {
	it("postgres를 선택할 수 있고 앞뒤 공백을 무시한다", () => {
		expect(resolveContentRepositorySource("postgres")).toBe("postgres");
		expect(resolveContentRepositorySource("  postgres  ")).toBe("postgres");
	});

	it("미설정이면 조용히 대체하지 않고 실패한다", () => {
		expect(() => resolveContentRepositorySource(undefined)).toThrow(/CMS_PUBLIC_REPOSITORY/);
		expect(() => resolveContentRepositorySource("")).toThrow(/CMS_PUBLIC_REPOSITORY/);
		expect(() => resolveContentRepositorySource("   ")).toThrow(/CMS_PUBLIC_REPOSITORY/);
	});

	it("제거된 keystatic을 명시하면 실패한다", () => {
		expect(() => resolveContentRepositorySource("keystatic")).toThrow(/CMS_PUBLIC_REPOSITORY/);
	});

	it("알 수 없는 값은 조용히 대체하지 않고 실패한다", () => {
		expect(() => resolveContentRepositorySource("mysql")).toThrow(/CMS_PUBLIC_REPOSITORY/);
	});

	it("허용 목록은 postgres뿐이다", () => {
		expect([...CONTENT_REPOSITORY_SOURCES]).toEqual(["postgres"]);
	});
});
