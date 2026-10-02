import { describe, expect, it } from "vitest";
import { normalizeSlug } from "../slug";

describe("normalizeSlug", () => {
	it("값이 없으면 터지지 않고 빈 문자열을 돌려준다", () => {
		// 빌드 수집 단계에서 params 없이 호출돼도 빌드가 깨지면 안 된다.
		expect(normalizeSlug(undefined)).toBe("");
		expect(normalizeSlug(null)).toBe("");
		expect(normalizeSlug("")).toBe("");
		expect(normalizeSlug("   ")).toBe("");
	});

	it("NFD 한글을 NFC로 모은다", () => {
		const nfd = "\u1100\u1161";
		expect(normalizeSlug(nfd)).toBe(nfd.normalize("NFC"));
	});

	it("퍼센트 인코딩을 디코딩한다", () => {
		expect(normalizeSlug("%EA%B0%80")).toBe("가");
	});

	it("잘못된 퍼센트 인코딩은 원문을 돌려준다", () => {
		expect(normalizeSlug("%E0%A4%A")).toBe("%E0%A4%A");
	});

	it("앞뒤 공백을 제거한다", () => {
		expect(normalizeSlug("  hello  ")).toBe("hello");
	});
});
