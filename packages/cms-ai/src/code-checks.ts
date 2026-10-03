import { checkPattern, ruleMatches } from "@bh2980/cms/code-block";
import { defineAiCheck } from "./action";

/**
 * 기본 기능이 쓰는 코드 검사. 사이트 기능에도 그대로 넣을 수 있다.
 *
 * ```ts
 * aiAction({ ..., checks: [{ kind: "pattern", pattern: "^[a-z-]+$" }, uniqueSlug] })
 * ```
 */

/** 같은 컬렉션·언어의 다른 항목이 이미 쓰는 주소(slug)는 뺀다. */
export const uniqueSlug = defineAiCheck({
	name: "unique-slug",
	label: "중복 없음",
	run: async (value, context) => !(await context.slugsInUse([value])).has(value),
});

/** 올바른 정규식이고 코드 입력(`input`, 없으면 `code`)에서 한 곳 이상 찾는 것만. 찾은 곳 수를 후보 옆에 붙인다. */
export const regexRuns = (input = "code") =>
	defineAiCheck({
		name: "regex-runs",
		label: "정규식 실행",
		run: (value, context) => {
			if (checkPattern(value, "g")) return false;
			const code = context.input[input];
			const count = ruleMatches(
				{ id: "check", scope: "document", name: "fold", pattern: value, flags: "g", attrs: {} },
				typeof code === "string" ? code : "",
			).length;
			return count > 0 ? { detail: `${count}곳` } : false;
		},
	});

/** MDX 결과가 원문 입력(`input`)과 같은 뼈대(요소·링크·코드·속성)인 것만. 번역에 쓴다. */
export const sameStructure = (input: string) =>
	defineAiCheck({
		name: "same-structure",
		label: "구조 유지",
		run: async (value, context) => {
			const source = context.input[input];
			if (typeof source !== "string") return true;
			// MDX 읽기는 사이트 설정(블록 목록)을 읽는다. 설정이 이 파일(기본 기능)을 불러오므로 실행할 때 읽는다.
			const { compareStructure } = await import("@bh2980/cms/client");
			const verdict = compareStructure(source, value);
			return verdict.ok ? true : verdict.reason;
		},
	});
