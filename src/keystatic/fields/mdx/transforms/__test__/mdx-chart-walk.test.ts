import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { walkOnlyInsideChart, walkOnlyInsideChartCodeFence } from "../mdx-chart-walk";

describe("mdx chart walk", () => {
	it("walkOnlyInsideChartCodeFence: chart code fence를 Chart mdast로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "chart",
					value: ["chart bar", "x month", "", "data", "month | views", "Jan | 1200"].join("\n"),
				},
			],
		};

		walkOnlyInsideChartCodeFence(input);

		const converted = input.children[0];
		expect(converted?.type).toBe("mdxJsxFlowElement");
		if (!converted || converted.type !== "mdxJsxFlowElement") {
			throw new Error("Expected converted node to be mdxJsxFlowElement");
		}

		expect(converted.name).toBe("Chart");
		expect(converted.attributes).toMatchObject([{ type: "mdxJsxAttribute", name: "lang", value: "chart" }]);
		expect(converted.children).toHaveLength(6);
		expect(converted.children[0]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "chart bar" }],
		});
		expect(converted.children[2]).toMatchObject({
			type: "paragraph",
			children: [],
		});
	});

	it("walkOnlyInsideChartCodeFence: non-chart code fence는 변환하지 않는다", () => {
		const input: Root = {
			type: "root",
			children: [{ type: "code", lang: "ts", value: "const value = 1;" }],
		};

		walkOnlyInsideChartCodeFence(input);
		expect(input.children[0]).toMatchObject({ type: "code", lang: "ts" });
	});

	it("walkOnlyInsideChart: Chart mdast를 chart code fence로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "Chart",
					attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "chart" }],
					children: [
						{ type: "paragraph", children: [{ type: "text", value: "chart line" }] },
						{ type: "paragraph", children: [{ type: "text", value: "x month" }] },
						{ type: "paragraph", children: [] },
						{ type: "paragraph", children: [{ type: "text", value: "data" }] },
					],
				},
			],
		};

		walkOnlyInsideChart(input);

		const converted = input.children[0];
		expect(converted?.type).toBe("code");
		if (!converted || converted.type !== "code") {
			throw new Error("Expected converted node to be code");
		}

		expect(converted.lang).toBe("chart");
		expect(converted.value).toBe(["chart line", "x month", "", "data"].join("\n"));
	});
});
