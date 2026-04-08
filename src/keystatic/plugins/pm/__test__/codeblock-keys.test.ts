import { describe, expect, it } from "vitest";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";
import { EDITOR_MATH_NAME } from "@/keystatic/fields/mdx/components/math";
import { EDITOR_MERMAID_NAME } from "@/keystatic/fields/mdx/components/mermaid";
import { isCodeBlockType } from "../codeblock-keys";

describe("isCodeBlockType", () => {
	it("코드/머메이드/수식 wrapper를 모두 코드블럭 계열로 인식한다", () => {
		expect(isCodeBlockType(EDITOR_CODE_BLOCK_NAME)).toBe(true);
		expect(isCodeBlockType(EDITOR_MERMAID_NAME)).toBe(true);
		expect(isCodeBlockType(EDITOR_MATH_NAME)).toBe(true);
	});

	it("다른 wrapper는 코드블럭 계열로 취급하지 않는다", () => {
		expect(isCodeBlockType("Callout")).toBe(false);
	});
});
