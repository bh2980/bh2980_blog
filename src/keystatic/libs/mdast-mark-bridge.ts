import type { Parents, Root, RootContent } from "mdast";
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
type MdxTextElementNode = Extract<RootContent, { type: "mdxJsxTextElement" }>;
type MdastMarkNode = Extract<RootContent, { type: MdastMarkName }>;
type ParentContentNode = Extract<Parents, RootContent>;

type VisitFrame = {
	parent: Parents;
	index: number;
	insideCodeBlock: boolean;
};

const hasChildren = (node: RootContent): node is ParentContentNode =>
	"children" in node && Array.isArray(node.children);

const isCodeBlockFlow = (node: RootContent) =>
	node.type === "mdxJsxFlowElement" && node.name === EDITOR_CODE_BLOCK_NAME;

const isMdastMark = (node: RootContent): node is MdastMarkNode =>
	node.type === "strong" || node.type === "delete" || node.type === "emphasis";

const isMdxMark = (node: RootContent): node is MdxTextElementNode & { name: MdxMarkName } =>
	node.type === "mdxJsxTextElement" && (node.name === "strong" || node.name === "del" || node.name === "em");

const walkAndReplace = (
	root: Root,
	replace: (node: RootContent, insideCodeBlock: boolean) => RootContent | null,
) => {
	const stack: VisitFrame[] = [];

	for (let index = root.children.length - 1; index >= 0; index -= 1) {
		stack.push({ parent: root, index, insideCodeBlock: false });
	}

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		const node = current.parent.children[current.index];
		if (!node) continue;

		const replaced = replace(node, current.insideCodeBlock);
		const target = replaced ?? node;
		if (replaced) {
			current.parent.children[current.index] = replaced;
		}

		const nextInsideCodeBlock = current.insideCodeBlock || isCodeBlockFlow(target);
		if (!hasChildren(target)) continue;

		for (let index = target.children.length - 1; index >= 0; index -= 1) {
			stack.push({
				parent: target,
				index,
				insideCodeBlock: nextInsideCodeBlock,
			});
		}
	}
};

export const convertBodyMdastMarksToMdxJsxTextElement = (mdxAst: Root) => {
	walkAndReplace(mdxAst, (node, insideCodeBlock) => {
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
	walkAndReplace(mdxAst, (node, insideCodeBlock) => {
		if (insideCodeBlock || !isMdxMark(node)) return null;
		if (node.attributes.length > 0) return null;

		return {
			type: MDAST_MARK_BY_MDX_MARK[node.name],
			children: node.children,
		};
	});
};
