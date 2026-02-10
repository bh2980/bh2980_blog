import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { walkOnlyInsideCodeblock, walkOnlyInsideCodeFence } from "../mdx-code-block-walk";

describe("mdx code-block walk", () => {
	it("walkOnlyInsideCodeFence: code fence를 CodeBlock mdast로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{ type: "paragraph", children: [{ type: "text", value: "body" }] },
				{
					type: "code",
					lang: "ts",
					value: ["// @char strong {0-4}", "hello"].join("\n"),
				},
			],
		};

		walkOnlyInsideCodeFence(input, annotationConfig);

		const converted = input.children[1];
		expect(converted?.type).toBe("mdxJsxFlowElement");
		if (!converted || converted.type !== "mdxJsxFlowElement") {
			throw new Error("Expected converted node to be mdxJsxFlowElement");
		}

		expect(converted.name).toBe("CodeBlock");
		const lang = converted.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "lang");
		expect(lang).toMatchObject({ value: "ts" });
	});

	it("walkOnlyInsideCodeFence: mermaid code fence는 변환하지 않는다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "mermaid",
					value: "graph TD; A-->B;",
				},
			],
		};

		walkOnlyInsideCodeFence(input, annotationConfig);
		expect(input.children[0]?.type).toBe("code");
	});

	it("walkOnlyInsideCodeblock: CodeBlock mdast를 code fence로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "CodeBlock",
					attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "ts" }],
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "mdxJsxTextElement",
									name: "strong",
									attributes: [],
									children: [{ type: "text", value: "hello" }],
								},
							],
						},
					],
				},
			],
		};

		walkOnlyInsideCodeblock(input, annotationConfig);

		const converted = input.children[0];
		expect(converted?.type).toBe("code");
		if (!converted || converted.type !== "code") {
			throw new Error("Expected converted node to be code");
		}

		expect(converted.lang).toBe("ts");
		expect(converted.value).toContain("@char strong {0-4}");
		expect(converted.value).toContain("hello");
	});
});
