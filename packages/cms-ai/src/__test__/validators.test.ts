import { describe, expect, it } from "vitest";
import type { AiValidatorContext } from "../action";
import { regexRuns, sameStructure, uniqueSlug } from "../validators";

const context = (input: Record<string, unknown>, taken: string[] = []): AiValidatorContext => ({
	input,
	slugsInUse: async (slugs) => new Set(slugs.filter((slug) => taken.includes(slug))),
});

describe("기본 코드 검사", () => {
	it("중복 없음은 다른 항목이 쓰는 주소를 뺀다", async () => {
		expect(await uniqueSlug.run("taken-slug", context({}, ["taken-slug"]))).toBe(false);
		expect(await uniqueSlug.run("fresh-slug", context({}, ["taken-slug"]))).toBe(true);
	});

	it("정규식 실행은 문법이 맞고 코드 입력에서 한 곳 이상 찾는 것만 남기고 찾은 곳 수를 붙인다", () => {
		const code = "import { a, b, c } from 'x';\nconst value = 1;\nconst other = 2;";
		const check = regexRuns("code");
		expect(check.run("const \\w+", context({ code }))).toEqual({ detail: "2곳" });
		expect(check.run("(", context({ code }))).toBe(false);
		expect(check.run("nothing-here", context({ code }))).toBe(false);
	});

	it("구조 유지는 원문 입력과 뼈대가 다르면 이유를 돌려준다", async () => {
		const check = sameStructure("block");
		expect(await check.run("Hello [link](/a)", context({ block: "안녕 [링크](/a)" }))).toBe(true);
		expect(await check.run("Hello", context({ block: "안녕 [링크](/a)" }))).toMatch("구조");
	});
});
