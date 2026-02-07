import type { Root } from "mdast";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";

const MDX_MARK_BY_MDAST_MARK = {
	strong: "strong",
	delete: "del",
	emphasis: "em",
} as const;

const MDAST_MARK_BY_MDX_MARK = {
	strong: "strong",
	del: "delete",
	em: "emphasis",
} as const;

type MdastMarkName = keyof typeof MDX_MARK_BY_MDAST_MARK;
type MdxMarkName = keyof typeof MDAST_MARK_BY_MDX_MARK;

type TreeNode = {
	type: string;
	name?: string;
	children?: TreeNode[];
	attributes?: unknown[];
};

const hasChildren = (node: TreeNode): node is TreeNode & { children: TreeNode[] } => Array.isArray(node.children);

const isCodeBlockFlow = (node: TreeNode): node is TreeNode & { name: string } =>
	node.type === "mdxJsxFlowElement" && node.name === EDITOR_CODE_BLOCK_NAME;

const isMdastMark = (node: TreeNode): node is TreeNode & { type: MdastMarkName; children: TreeNode[] } =>
	node.type === "strong" || node.type === "delete" || node.type === "emphasis";

const isMdxMark = (
	node: TreeNode,
): node is TreeNode & { type: "mdxJsxTextElement"; name: MdxMarkName; attributes: unknown[]; children: TreeNode[] } =>
	node.type === "mdxJsxTextElement" &&
	(node.name === "strong" || node.name === "del" || node.name === "em");

const walkAndReplace = (
	nodes: TreeNode[],
	replace: (node: TreeNode, insideCodeBlock: boolean) => TreeNode | null,
	insideCodeBlock = false,
) => {
	for (let index = 0; index < nodes.length; index += 1) {
		const current = nodes[index];
		if (!current) continue;

		const nextInsideCodeBlock = insideCodeBlock || isCodeBlockFlow(current);
		const replaced = replace(current, insideCodeBlock);
		const target = replaced ?? current;
		nodes[index] = target;

		if (hasChildren(target)) {
			walkAndReplace(target.children, replace, nextInsideCodeBlock);
		}
	}
};

export const convertBodyMdastMarksToMdxJsxTextElement = (mdxAst: Root) => {
	walkAndReplace(mdxAst.children as TreeNode[], (node, insideCodeBlock) => {
		if (insideCodeBlock || !isMdastMark(node)) return null;

		return {
			type: "mdxJsxTextElement",
			name: MDX_MARK_BY_MDAST_MARK[node.type],
			attributes: [],
			children: node.children,
		};
	});
};

export const convertBodyMdxJsxTextElementToMdastMarks = (mdxAst: Root) => {
	walkAndReplace(mdxAst.children as TreeNode[], (node, insideCodeBlock) => {
		if (insideCodeBlock || !isMdxMark(node)) return null;
		if (node.attributes.length > 0) return null;

		return {
			type: MDAST_MARK_BY_MDX_MARK[node.name],
			children: node.children,
		};
	});
};
