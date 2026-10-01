import { describe, expect, it } from "vitest";
import { BUILTIN_AI_FEATURES, withBuiltin } from "../builtins";
import { checkCandidates, checkText } from "../checks";
import { type AiCheck, aiFeatureSpecSchema, KEBAB_PATTERN } from "../definition";
import { availableChecks } from "../targets";

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

	it("대상이 재료를 줄 수 있는 검사만 고를 수 있다", () => {
		expect(availableChecks("field", "slug", "post")).toEqual(["pattern", "maxLength", "unique"]);
		expect(availableChecks("field", "tagIds", "post")).toEqual(["pattern", "maxLength", "exists"]);
		expect(availableChecks("field", "summary", "post")).toEqual(["pattern", "maxLength"]);
		expect(availableChecks("codeRules", "fold")).toEqual(["pattern", "maxLength", "regexRuns"]);
	});
});

describe("기능 목록", () => {
	it("모든 기능 정의가 규칙에 맞고, 검사는 대상이 줄 수 있는 것만 쓴다", () => {
		for (const [key, feature] of Object.entries(BUILTIN_AI_FEATURES)) {
			const spec = aiFeatureSpecSchema.parse(feature.spec);
			const allowed = availableChecks(spec.slot, spec.target, spec.collections[0]);
			for (const check of spec.checks) expect(allowed, key).toContain(check.kind);
		}
	});

	it("정해 둔 부분은 사용자 값보다 앞서고, 검사는 켜기·값만 바뀐다", () => {
		const spec = withBuiltin("slug", {
			...BUILTIN_AI_FEATURES.slug?.spec,
			name: "바꾼 이름",
			slot: "media",
			target: "filename",
			prompt: "바꾼 지시문",
			checks: [{ kind: "unique", enabled: false }, { kind: "regexRuns" }, { kind: "maxLength", max: 40 }],
		});
		expect(spec).toMatchObject({ name: "주소 추천", slot: "field", target: "slug", prompt: "바꾼 지시문" });
		expect(spec?.checks).toEqual([
			{ kind: "pattern", pattern: KEBAB_PATTERN, enabled: true },
			{ kind: "maxLength", max: 40, enabled: true },
			{ kind: "unique", enabled: false },
		]);
	});

	it("예전 모양(검사 하나 + 글자 수)으로 저장한 정의도 검사 목록으로 읽는다", () => {
		const legacy = { ...BUILTIN_AI_FEATURES.summary?.spec, checks: undefined, check: "maxLength", maxLength: 120 };
		delete legacy.checks;
		expect(aiFeatureSpecSchema.parse(legacy).checks).toEqual([{ kind: "maxLength", max: 120, enabled: true }]);
		expect(withBuiltin("unknown", legacy)).toBeNull();
	});

	it("올바르지 않은 정규식은 저장하지 않는다", () => {
		const bad = { ...BUILTIN_AI_FEATURES.slug?.spec, checks: [{ kind: "pattern", pattern: "(" }] };
		expect(aiFeatureSpecSchema.safeParse(bad).success).toBe(false);
	});
});
