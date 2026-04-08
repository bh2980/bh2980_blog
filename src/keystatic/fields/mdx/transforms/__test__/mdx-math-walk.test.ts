import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { INTERNAL_MATH_FENCE_LANG } from "../math-block";
import { walkOnlyInsideMath, walkOnlyInsideMathCodeFence } from "../mdx-math-walk";

describe("mdx math walk", () => {
	it("walkOnlyInsideMathCodeFence: math code fence를 Math mdast로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{ type: "paragraph", children: [{ type: "text", value: "body" }] },
				{
					type: "code",
					lang: INTERNAL_MATH_FENCE_LANG,
					value: ["x^2", "", "y^2"].join("\n"),
				},
			],
		};

		walkOnlyInsideMathCodeFence(input);

		const converted = input.children[1];
		expect(converted?.type).toBe("mdxJsxFlowElement");
		if (!converted || converted.type !== "mdxJsxFlowElement") {
			throw new Error("Expected converted node to be mdxJsxFlowElement");
		}

		expect(converted.name).toBe("Math");
		expect(converted.children).toHaveLength(3);
		expect(converted.children[0]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "x^2" }],
		});
		expect(converted.children[1]).toMatchObject({
			type: "paragraph",
			children: [],
		});
	});

	it("walkOnlyInsideMath: Math mdast를 math code fence로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "Math",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "\\alpha + \\beta" }],
						},
					],
				},
			],
		};

		walkOnlyInsideMath(input);

		const converted = input.children[0];
		expect(converted?.type).toBe("code");
		if (!converted || converted.type !== "code") {
			throw new Error("Expected converted node to be code");
		}

		expect(converted.lang).toBe(INTERNAL_MATH_FENCE_LANG);
		expect(converted.value).toBe("\\alpha + \\beta");
	});

	it("walkOnlyInsideMathCodeFence: 사용자가 작성한 math code fence는 변환하지 않는다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "math",
					value: "\\alpha + \\beta",
				},
			],
		};

		walkOnlyInsideMathCodeFence(input);

		expect(input.children[0]).toMatchObject({ type: "code", lang: "math", value: "\\alpha + \\beta" });
	});
});
