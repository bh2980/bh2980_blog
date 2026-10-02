import { checkPattern, ruleMatches } from "@bh2980/cms/annotation/code-block/model";
import type { AiCandidate, AiCheck } from "./definition";

/**
 * 결과 검사(순수 함수). 기능에 적힌 검사 목록 중 켜 둔 것을 차례로 적용해, 통과하지 못한 후보는 버린다.
 * 후보를 고치거나 잘라 내지 않는다. 검사는 기능 편집기에 보이는 것이 전부다.
 */

export interface CheckEnv {
	/** 현재 값. 이미 같은 값인 후보는 뺀다. */
	current?: string | readonly string[];
	/** 고를 수 있는 값 → 보이는 이름(`있는 값만` 검사, 후보 이름 표시). */
	options?: ReadonlyMap<string, string>;
	/** 다른 항목이 이미 쓰는 값(`중복 없음` 검사). */
	taken?: ReadonlySet<string>;
	/** 정규식을 실행해 볼 코드(`정규식 실행` 검사). */
	code?: string;
}

const matchesPattern = (pattern: string, value: string) => {
	try {
		return new RegExp(pattern, "u").test(value);
	} catch {
		return false;
	}
};

/** 검사 하나. 통과하면 덧붙일 설명(찾은 곳 수 등)이나 빈 글자, 통과하지 못하면 `null`. */
function runCheck(check: AiCheck, value: string, env: CheckEnv): string | null {
	switch (check.kind) {
		case "pattern":
			return matchesPattern(check.pattern, value) ? "" : null;
		case "maxLength":
			return Array.from(value).length <= check.max ? "" : null;
		case "unique":
			return env.taken?.has(value) ? null : "";
		case "exists":
			return env.options?.has(value) ? "" : null;
		case "structure":
			// 본문 번역에서 원문과 비교해 따로 본다(`translate.ts`). 후보 검사에서는 통과로 둔다.
			return "";
		case "regexRuns": {
			if (checkPattern(value, "g")) return null;
			const count = ruleMatches(
				{ id: "check", scope: "document", name: "fold", pattern: value, flags: "g", attrs: {} },
				env.code ?? "",
			).length;
			return count > 0 ? `${count}곳` : null;
		}
	}
}

export function checkCandidates(checks: readonly AiCheck[], raw: readonly string[], env: CheckEnv): AiCandidate[] {
	const current = new Set(Array.isArray(env.current) ? env.current : env.current ? [env.current] : []);
	const seen = new Set<string>();
	const items: AiCandidate[] = [];
	for (const value of raw.map((text) => text.trim())) {
		if (!value || seen.has(value) || current.has(value)) continue;
		seen.add(value);
		const details: string[] = [];
		let passed = true;
		for (const check of checks) {
			if (!check.enabled) continue;
			const detail = runCheck(check, value, env);
			if (detail === null) {
				passed = false;
				break;
			}
			if (detail) details.push(detail);
		}
		if (!passed) continue;
		items.push({
			value,
			label: env.options?.get(value) ?? value,
			...(details.length > 0 ? { detail: details.join(" · ") } : {}),
		});
	}
	return items;
}

/** 긴 글 결과의 검사. 통과하지 못하면 이유를 돌려준다. */
export function checkText(checks: readonly AiCheck[], text: string): string | null {
	if (!text.trim()) return "빈 결과입니다.";
	for (const check of checks) {
		if (!check.enabled) continue;
		if (check.kind === "pattern" && !matchesPattern(check.pattern, text.trim())) return "형식에 맞지 않습니다.";
		if (check.kind === "maxLength" && Array.from(text.trim()).length > check.max) return `${check.max}자를 넘었습니다.`;
	}
	return null;
}
