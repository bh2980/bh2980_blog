import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { walkOnlyInsideMermaid, walkOnlyInsideMermaidCodeFence } from "../mdx-mermaid-walk";

describe("mdx mermaid walk", () => {
	it("walkOnlyInsideMermaidCodeFence: mermaid code fence를 Mermaid mdast로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{ type: "paragraph", children: [{ type: "text", value: "body" }] },
				{
					type: "code",
					lang: "mermaid",
					value: ["graph TD;", "A-->B;"].join("\n"),
				},
			],
		};

		walkOnlyInsideMermaidCodeFence(input);

		const converted = input.children[1];
		expect(converted?.type).toBe("mdxJsxFlowElement");
		if (!converted || converted.type !== "mdxJsxFlowElement") {
			throw new Error("Expected converted node to be mdxJsxFlowElement");
		}

		expect(converted.name).toBe("Mermaid");
		expect(converted.attributes).toMatchObject([{ type: "mdxJsxAttribute", name: "lang", value: "mermaid" }]);
		expect(converted.children).toHaveLength(2);
		expect(converted.children[0]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "graph TD;" }],
		});
		expect(converted.children[1]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "A-->B;" }],
		});
	});

	it("walkOnlyInsideMermaidCodeFence: non-mermaid code fence는 변환하지 않는다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					value: "console.log('hello');",
				},
			],
		};

		walkOnlyInsideMermaidCodeFence(input);
		expect(input.children[0]).toMatchObject({ type: "code", lang: "ts" });
	});

	it("walkOnlyInsideMermaid: Mermaid mdast를 mermaid code fence로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "Mermaid",
					attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "mermaid" }],
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "graph TD;" }],
						},
						{
							type: "paragraph",
							children: [{ type: "text", value: "A-->B;" }],
						},
					],
				},
			],
		};

		walkOnlyInsideMermaid(input);

		const converted = input.children[0];
		expect(converted?.type).toBe("code");
		if (!converted || converted.type !== "code") {
			throw new Error("Expected converted node to be code");
		}

		expect(converted.lang).toBe("mermaid");
		expect(converted.value).toBe(["graph TD;", "A-->B;"].join("\n"));
	});

	it("walkOnlyInsideMermaid: lang attribute가 없으면 mermaid를 기본 언어로 사용한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "Mermaid",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "graph TD;" }],
						},
					],
				},
			],
		};

		walkOnlyInsideMermaid(input);

		const converted = input.children[0];
		expect(converted?.type).toBe("code");
		if (!converted || converted.type !== "code") {
			throw new Error("Expected converted node to be code");
		}

		expect(converted.lang).toBe("mermaid");
		expect(converted.value).toBe("graph TD;");
	});

	it("walkOnlyInsideMermaid: Mermaid가 아닌 mdxJsxFlowElement는 변환하지 않는다", () => {
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
							children: [{ type: "text", value: "const a = 1;" }],
						},
					],
				},
			],
		};

		walkOnlyInsideMermaid(input);
		expect(input.children[0]).toMatchObject({ type: "mdxJsxFlowElement", name: "CodeBlock" });
	});
});
