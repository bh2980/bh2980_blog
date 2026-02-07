import type { Root, RootContent } from "mdast";
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
type ParentWithChildren = { children: unknown[] };
type VisitFrame = {
	parent: ParentWithChildren;
	index: number;
	phase: "enter" | "exit";
};

const isCodeBlockFlow = (node: RootContent) =>
	node.type === "mdxJsxFlowElement" && node.name === EDITOR_CODE_BLOCK_NAME;

const isMdastMark = (node: RootContent): node is MdastMarkNode =>
	node.type === "strong" || node.type === "delete" || node.type === "emphasis";

const isMdxMark = (node: RootContent): node is MdxTextElementNode & { name: MdxMarkName } =>
	node.type === "mdxJsxTextElement" && (node.name === "strong" || node.name === "del" || node.name === "em");

const hasChildren = (node: RootContent): node is RootContent & ParentWithChildren =>
	"children" in node && Array.isArray(node.children);

const isRootContent = (node: unknown): node is RootContent =>
	typeof node === "object" && node !== null && "type" in node && typeof node.type === "string";

const replaceByPostOrder = (root: Root, replace: (node: RootContent) => RootContent | null) => {
	const stack: VisitFrame[] = [];

	for (let index = root.children.length - 1; index >= 0; index -= 1) {
		stack.push({ parent: root as ParentWithChildren, index, phase: "enter" });
	}

	while (stack.length > 0) {
		const frame = stack.pop();
		if (!frame) continue;

		const rawNode = frame.parent.children[frame.index];
		if (!isRootContent(rawNode)) continue;

		if (frame.phase === "enter") {
			if (isCodeBlockFlow(rawNode)) continue;

			stack.push({ parent: frame.parent, index: frame.index, phase: "exit" });

			if (!hasChildren(rawNode)) continue;

			for (let index = rawNode.children.length - 1; index >= 0; index -= 1) {
				stack.push({ parent: rawNode as ParentWithChildren, index, phase: "enter" });
			}
			continue;
		}

		const replaced = replace(rawNode);
		if (!replaced) continue;
		frame.parent.children[frame.index] = replaced;
	}
};

export const convertBodyMdastMarksToMdxJsxTextElement = (mdxAst: Root) => {
	replaceByPostOrder(mdxAst, (node) => {
		if (!isMdastMark(node)) return null;

		return {
			type: "mdxJsxTextElement",
			name: MDX_MARK_BY_MDAST_MARK[node.type],
			attributes: [],
			children: node.children,
		};
	});
};

export const convertBodyMdxJsxTextElementToMdastMarks = (mdxAst: Root) => {
	replaceByPostOrder(mdxAst, (node) => {
		if (!isMdxMark(node)) return null;
		if (node.attributes.length > 0) return null;

		return {
			type: MDAST_MARK_BY_MDX_MARK[node.name],
			children: node.children,
		};
	});
};
