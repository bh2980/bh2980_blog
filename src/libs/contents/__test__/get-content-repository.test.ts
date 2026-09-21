import { describe, expect, it } from "vitest";
import { CONTENT_REPOSITORY_SOURCES, resolveContentRepositorySource } from "../repositories/source";

describe("M7-BE-1 공개 조회 저장소 플래그", () => {
	it("값이 없으면 전환 승인 전까지 keystatic을 쓴다", () => {
		expect(resolveContentRepositorySource(undefined)).toBe("keystatic");
		expect(resolveContentRepositorySource("")).toBe("keystatic");
		expect(resolveContentRepositorySource("   ")).toBe("keystatic");
	});

	it("postgres를 선택할 수 있고 앞뒤 공백을 무시한다", () => {
		expect(resolveContentRepositorySource("postgres")).toBe("postgres");
		expect(resolveContentRepositorySource("  postgres  ")).toBe("postgres");
	});

	it("keystatic을 명시할 수 있다", () => {
		expect(resolveContentRepositorySource("keystatic")).toBe("keystatic");
	});

	it("알 수 없는 값은 조용히 대체하지 않고 실패한다", () => {
		expect(() => resolveContentRepositorySource("mysql")).toThrow(/CMS_PUBLIC_REPOSITORY/);
	});

	it("허용 목록은 keystatic과 postgres뿐이다", () => {
		expect([...CONTENT_REPOSITORY_SOURCES]).toEqual(["keystatic", "postgres"]);
	});
});
