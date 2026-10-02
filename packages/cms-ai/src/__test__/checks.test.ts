import { describe, expect, it } from "vitest";
import { checkCandidates, checkText } from "../checks";
import { type AiCheck, KEBAB_PATTERN } from "../definition";

const on = <T extends Omit<AiCheck, "enabled">>(check: T) => ({ ...check, enabled: true }) as AiCheck;

describe("AI 결과 검사", () => {
	it("형식·길이·중복 없음을 차례로 적용하고, 값을 고치지 않고 버린다", () => {
		const checks = [
			on({ kind: "pattern", pattern: KEBAB_PATTERN }),
			on({ kind: "maxLength", max: 20 }),
			on({ kind: "unique" }),
		];
		const items = checkCandidates(
			checks,
			[
				"react-query-guide",
				"Next.js Scroll",
				"taken-slug",
				"a-very-long-slug-over-twenty",
				"same",
				"react-query-guide",
			],
			{ taken: new Set(["taken-slug"]), current: "same" },
		);
		expect(items.map((item) => item.value)).toEqual(["react-query-guide"]);
	});

	it("있는 값만 받고, 검사가 없어도 선택지 이름으로 보인다", () => {
		const options = new Map([
			["t1", "React"],
			["t2", "Next.js"],
		]);
		expect(checkCandidates([on({ kind: "exists" })], ["t1", "unknown"], { options })).toEqual([
			{ value: "t1", label: "React" },
		]);
		expect(checkCandidates([], ["t2", "unknown"], { options })).toEqual([
			{ value: "t2", label: "Next.js" },
			{ value: "unknown", label: "unknown" },
		]);
	});

	it("정규식 실행은 문법이 맞고 코드에서 한 곳 이상 찾는 것만 남기고 찾은 곳 수를 붙인다", () => {
		const code = "import { a, b, c } from 'x';\nconst value = 1;\nconst other = 2;";
		const items = checkCandidates([on({ kind: "regexRuns" })], ["const \\w+", "(", "nothing-here"], { code });
		expect(items).toEqual([{ value: "const \\w+", label: "const \\w+", detail: "2곳" }]);
	});

	it("꺼 둔 검사는 적용하지 않는다", () => {
		const checks: AiCheck[] = [{ kind: "maxLength", max: 3, enabled: false }];
		expect(checkCandidates(checks, ["네 글자다"], {}).map((item) => item.value)).toEqual(["네 글자다"]);
	});

	it("긴 글은 형식·길이만 본다", () => {
		expect(checkText([on({ kind: "maxLength", max: 5 })], "여섯 글자다")).toMatch("5자");
		expect(checkText([on({ kind: "pattern", pattern: "^요약" })], "요약입니다")).toBeNull();
		expect(checkText([], "  ")).toBeTruthy();
	});
});
