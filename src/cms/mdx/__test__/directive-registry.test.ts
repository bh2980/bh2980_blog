import { describe, expect, it } from "vitest";
import { MDX_COMPONENTS } from "@/components/mdx/mdx-content";
import { DIRECTIVES } from "../directives";
import { BLOCK_JSX_NAMES, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "../registry";

/**
 * M8-TW-1 이름 정합성. 등록된 이름에 렌더러·레지스트리가 빠지면 공개 글이 조용히 비어 보인다
 * ("If directives are not handled, they do not emit anything").
 */
describe("M8-TW-1 레지스트리·렌더러 대조", () => {
	it("등록 directive의 컴포넌트가 렌더러 표에 있다", () => {
		const missing = DIRECTIVES.filter(
			(definition) => /^[A-Z]/.test(definition.component) && !(definition.component in MDX_COMPONENTS),
		).map((definition) => definition.name);

		expect(missing).toEqual([]);
	});

	it("등록 directive의 컴포넌트 이름이 레지스트리에도 있다", () => {
		const missing = DIRECTIVES.filter((definition) => !REGISTERED_JSX_NAMES.has(definition.component)).map(
			(definition) => definition.name,
		);

		expect(missing).toEqual([]);
	});

	it("폐기 이름은 레지스트리·렌더러 어디에도 없다", () => {
		expect([...RETIRED_JSX_NAMES].sort()).toEqual(["ContentLink", "IdeographicSpace"]);
		for (const name of RETIRED_JSX_NAMES) {
			expect(REGISTERED_JSX_NAMES.has(name)).toBe(false);
			expect(BLOCK_JSX_NAMES.has(name)).toBe(false);
			expect(name in MDX_COMPONENTS).toBe(false);
		}
	});
});
