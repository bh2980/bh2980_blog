import { describe, expect, it } from "vitest";
import { CUSTOM_BLOCKS, customBaseSchema, customDefinition, surfaceProblem } from "../custom";

// 예시 설정(`cms-ai/test/cms.config.ts`)은 블록 확장의 블록과 사용자 블록 `notice`·`embed`를 쓴다.
describe("화면 기능의 블록 자리", () => {
	it("고를 수 있는 블록은 편집기 노드로 편집하는 더한 블록이다(자식 전용·원문 상자 제외)", () => {
		const names = CUSTOM_BLOCKS.map((block) => block.name);
		expect(names).toEqual(expect.arrayContaining(["callout", "tabs", "mermaid", "chart", "notice"]));
		expect(names).not.toContain("tab");
		expect(names).not.toContain("embed");
		expect(names).not.toContain("image");
	});

	it("블록 자리는 MDX 결과만 고르고, 없는 블록은 알린다", () => {
		const base = (result: string, block = "mermaid") =>
			customBaseSchema.safeParse({ label: "고치기", surface: { slot: "block", block }, result });
		expect(base("mdx").success).toBe(true);
		expect(base("text").success).toBe(false);
		expect(surfaceProblem({ slot: "block", block: "mermaid" })).toBeNull();
		expect(surfaceProblem({ slot: "block", block: "nope" })).toBe("없는 블록입니다: nope");
	});

	it("블록 자리 기능은 블록 원문을 받아 흘려받는다", () => {
		const definition = customDefinition({ label: "고치기", surface: { slot: "block", block: "chart" }, result: "mdx" });
		expect(Object.keys(definition.input)).toEqual(["block", "title"]);
		expect(definition.input.block).toMatchObject({ kind: "mdx", required: true });
		expect(definition.stream).toBe(true);
		expect(definition.attach).toEqual([{ slot: "block", block: "chart" }]);
	});
});
