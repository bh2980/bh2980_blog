import { describe, expect, it } from "vitest";
import {
	INTERNAL_MATH_FENCE_LANG,
	replaceMathBlocksWithCodeFences,
	replaceMathCodeFencesWithBlocks,
} from "../math-block";

describe("math block string transform", () => {
	it("display math block을 내부 math code fence로 변환한다", () => {
		const input = ["본문", "$$", "\\int_0^1 x^2 \\, dx", "$$"].join("\n");

		expect(replaceMathBlocksWithCodeFences(input)).toBe(
			["본문", `\`\`\`${INTERNAL_MATH_FENCE_LANG}`, "\\int_0^1 x^2 \\, dx", "```"].join("\n"),
		);
	});

	it("코드 펜스 안의 $$는 건드리지 않는다", () => {
		const input = ["```ts", 'const formula = "$$";', "```"].join("\n");

		expect(replaceMathBlocksWithCodeFences(input)).toBe(input);
	});

	it("내부 math code fence를 다시 $$ block으로 복원한다", () => {
		const input = ["before", `\`\`\`${INTERNAL_MATH_FENCE_LANG}`, "\\frac{a}{b}", "```", "after"].join("\n");

		expect(replaceMathCodeFencesWithBlocks(input)).toBe(["before", "$$", "\\frac{a}{b}", "$$", "after"].join("\n"));
	});

	it("닫히지 않은 $$ block은 원문을 유지한다", () => {
		const input = ["$$", "x + y"].join("\n");

		expect(replaceMathBlocksWithCodeFences(input)).toBe(input);
	});

	it("리스트 안의 display math block은 들여쓰기를 유지한 채 내부 fence로 변환한다", () => {
		const input = ["- item", "  $$", "  x", "  $$"].join("\n");

		expect(replaceMathBlocksWithCodeFences(input)).toBe(
			["- item", `  \`\`\`${INTERNAL_MATH_FENCE_LANG}`, "  x", "  ```"].join("\n"),
		);
	});

	it("사용자가 직접 작성한 math code fence는 $$ block으로 바꾸지 않는다", () => {
		const input = ["```math", "\\alpha + \\beta", "```"].join("\n");

		expect(replaceMathCodeFencesWithBlocks(input)).toBe(input);
	});
});
