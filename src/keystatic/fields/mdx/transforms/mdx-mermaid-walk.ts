import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import { fromMdastToCodeBlockDocument } from "@/libs/annotation/code-block/mdast-to-document";
import { EDITOR_MERMAID_NAME } from "../components/mermaid";

export type MermaidRoot = MdxJsxFlowElement & { name: typeof EDITOR_MERMAID_NAME };

const isMermaid = (node: MdxJsxFlowElement): node is MermaidRoot => node.name === EDITOR_MERMAID_NAME;

export const walkOnlyInsideMermaidCodeFence = (mdxAst: Root) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang !== "mermaid") return;
		if (index == null || !parent) return;

		const mermaidRoot: MdxJsxFlowElement = {
			type: "mdxJsxFlowElement",
			name: EDITOR_MERMAID_NAME,
			attributes: [],
			children: [],
		};

		const document = fromCodeFenceToCodeBlockDocument(node, {});

		document.lines.forEach((line) => {
			const paragraph: Paragraph = {
				type: "paragraph",
				children: [
					{
						type: "text",
						value: line.value,
					} as Text,
				],
			};

			mermaidRoot.children.push(paragraph);
		});

		parent.children.splice(index, 1, mermaidRoot);
		return [SKIP, index];
	});
};

export const walkOnlyInsideMermaid = (mdxAst: Root) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (!isMermaid(node)) return;
		if (index == null || !parent) return;

		const document = fromMdastToCodeBlockDocument(node, {});
		const codeFence = fromCodeBlockDocumentToCodeFence(document, {});

		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};
