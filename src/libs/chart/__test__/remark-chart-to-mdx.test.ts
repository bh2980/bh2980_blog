import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { MDX_CHART_COMPONENT_NAME, remarkChartToMdx } from "../remark-chart-to-mdx";

describe("remarkChartToMdx", () => {
	it("chart code fence를 Chart MDX 컴포넌트로 변환한다", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "chart",
					value: ["chart pie", "label browser", "", "data"].join("\n"),
				},
			],
		};

		remarkChartToMdx()(tree);

		expect(tree.children[0]).toMatchObject({
			type: "mdxJsxFlowElement",
			name: MDX_CHART_COMPONENT_NAME,
			children: [
				{ type: "paragraph", children: [{ type: "text", value: "chart pie" }] },
				{ type: "paragraph", children: [{ type: "text", value: "label browser" }] },
				{ type: "paragraph", children: [] },
				{ type: "paragraph", children: [{ type: "text", value: "data" }] },
			],
		});
	});

	it("chart가 아닌 code fence는 그대로 둔다", () => {
		const tree: Root = {
			type: "root",
			children: [{ type: "code", lang: "ts", value: "const value = 1;" }],
		};

		remarkChartToMdx()(tree);

		expect(tree.children[0]).toMatchObject({
			type: "code",
			lang: "ts",
			value: "const value = 1;",
		});
	});
});
