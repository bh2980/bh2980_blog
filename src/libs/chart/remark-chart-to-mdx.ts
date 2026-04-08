import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";

export const MDX_CHART_COMPONENT_NAME = "Chart";

export const remarkChartToMdx = () => {
	return (tree: Root) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang?.toLowerCase() !== "chart") return;
			if (index == null || !parent) return;

			const chartNode: MdxJsxFlowElement = {
				type: "mdxJsxFlowElement",
				name: MDX_CHART_COMPONENT_NAME,
				attributes: [],
				children: node.value.split(/\r?\n/).map<Paragraph>((line) => ({
					type: "paragraph",
					children: line.length > 0 ? ([{ type: "text", value: line }] satisfies Text[]) : [],
				})),
			};

			parent.children.splice(index, 1, chartNode);
			return [SKIP, index];
		});
	};
};
