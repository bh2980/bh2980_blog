import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import { fromMdxFlowElementToCodeDocument } from "@/libs/annotation/code-block/mdast-to-document";
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
			attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "mermaid" }],
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

		const mermaidLangAttribute: Extract<MdxJsxFlowElement["attributes"][number], { type: "mdxJsxAttribute" }> = {
			type: "mdxJsxAttribute",
			name: "lang",
			value: "mermaid",
		};
		const hasStringLangAttribute = node.attributes.some(
			(attr) => attr.type === "mdxJsxAttribute" && attr.name === "lang" && typeof attr.value === "string",
		);
		const normalizedNode = hasStringLangAttribute
			? node
			: {
					...node,
					attributes: [...node.attributes, mermaidLangAttribute],
				};

		const document = fromMdxFlowElementToCodeDocument(normalizedNode, {});
		const codeFence = fromCodeBlockDocumentToCodeFence(document, {});

		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};
