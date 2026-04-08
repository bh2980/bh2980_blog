import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import { fromMdxFlowElementToCodeDocument } from "@/libs/annotation/code-block/mdast-to-document";
import { EDITOR_CHART_NAME } from "../components/chart";

export type ChartRoot = MdxJsxFlowElement & { name: typeof EDITOR_CHART_NAME };

const isChart = (node: MdxJsxFlowElement): node is ChartRoot => node.name === EDITOR_CHART_NAME;

export const walkOnlyInsideChartCodeFence = (mdxAst: Root) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang !== "chart") return;
		if (index == null || !parent) return;

		const chartRoot: MdxJsxFlowElement = {
			type: "mdxJsxFlowElement",
			name: EDITOR_CHART_NAME,
			attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "chart" }],
			children: [],
		};

		const document = fromCodeFenceToCodeBlockDocument(node, {}, { parseLineAnnotations: false });

		document.lines.forEach((line) => {
			const paragraph: Paragraph = {
				type: "paragraph",
				children: line.value.length > 0 ? ([{ type: "text", value: line.value }] satisfies Text[]) : [],
			};

			chartRoot.children.push(paragraph);
		});

		parent.children.splice(index, 1, chartRoot);
		return [SKIP, index];
	});
};

export const walkOnlyInsideChart = (mdxAst: Root) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (!isChart(node)) return;
		if (index == null || !parent) return;

		const hasStringLangAttribute = node.attributes.some(
			(attr) => attr.type === "mdxJsxAttribute" && attr.name === "lang" && typeof attr.value === "string",
		);
		const normalizedNode = hasStringLangAttribute
			? node
			: {
					...node,
					attributes: [...node.attributes, { type: "mdxJsxAttribute", name: "lang", value: "chart" } as const],
				};

		const document = fromMdxFlowElementToCodeDocument(normalizedNode, {});
		const codeFence = fromCodeBlockDocumentToCodeFence({ ...document, lang: "chart" }, {});

		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};
