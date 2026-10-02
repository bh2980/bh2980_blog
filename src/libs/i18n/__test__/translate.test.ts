import { describe, expect, it } from "vitest";
import { localeFromPath, localizePath } from "../locales";
import { ko } from "../messages/ko";
import { formatDate, missingMessageKeys, translator } from "../translate";

describe("공개 화면 문구(v2 B4)", () => {
	it("사전에 없는 문구는 한국어로 보이고 자리 값을 채운다", () => {
		expect(translator("en")("posts.all", { count: 3 })).toBe(ko["posts.all"].replace("{count}", "3"));
		expect(translator("ko")("mdx.chartErrorLine", { line: 2, message: "x" })).toBe("2줄: x");
	});

	it("아직 채우지 않은 번역 문구를 알려 준다", () => {
		for (const locale of ["en", "ja"] as const) {
			const missing = missingMessageKeys(locale);
			if (missing.length > 0) {
				console.info(
					`[i18n] ${locale} 사전에 없는 문구 ${missing.length}개 — 한국어로 보입니다: ${missing.join(", ")}`,
				);
			}
			expect(missing.every((key) => key in ko)).toBe(true);
		}
		expect(missingMessageKeys("ko")).toEqual([]);
	});

	it("날짜는 언어 형식이고 시간대는 서울이다", () => {
		// UTC 2026-09-26 18:30 = 서울 2026-09-27 03:30
		const value = "2026-09-26T18:30:00.000Z";
		expect(formatDate(value, "ko")).toBe("2026년 9월 27일");
		expect(formatDate(value, "en")).toBe("September 27, 2026");
		expect(formatDate(value, "ja")).toBe("2026年9月27日");
	});

	it("기본 언어는 접두사가 없고 다른 언어는 접두사가 붙는다", () => {
		expect(localizePath("ko", "/posts/a")).toBe("/posts/a");
		expect(localizePath("en", "/posts/a")).toBe("/en/posts/a");
		expect(localizePath("ja", "/")).toBe("/ja");
		expect(localeFromPath("/en/posts/a")).toBe("en");
		expect(localeFromPath("/ko/posts/a")).toBe("ko");
		expect(localeFromPath("/posts/a")).toBe("ko");
		expect(localeFromPath("/english")).toBe("ko");
	});
});
