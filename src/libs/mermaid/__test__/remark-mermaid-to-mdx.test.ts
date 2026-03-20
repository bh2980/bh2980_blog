import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { MDX_MERMAID_COMPONENT_NAME, remarkMermaidToMdx } from "../remark-mermaid-to-mdx";

describe("remarkMermaidToMdx", () => {
	it("mermaid code fence를 Mermaid MDX 컴포넌트로 변환한다", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "mermaid",
					value: ["graph TD;", "", "A-->B;"].join("\n"),
				},
			],
		};

		remarkMermaidToMdx()(tree);

		expect(tree.children[0]).toMatchObject({
			type: "mdxJsxFlowElement",
			name: MDX_MERMAID_COMPONENT_NAME,
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "graph TD;" }],
				},
				{
					type: "paragraph",
					children: [],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "A-->B;" }],
				},
			],
		});
	});

	it("mermaid가 아닌 code fence는 그대로 둔다", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					value: "const value = 1;",
				},
			],
		};

		remarkMermaidToMdx()(tree);

		expect(tree.children[0]).toMatchObject({
			type: "code",
			lang: "ts",
			value: "const value = 1;",
		});
	});
});
