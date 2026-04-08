import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import { fromMdxFlowElementToCodeDocument } from "@/libs/annotation/code-block/mdast-to-document";
import { EDITOR_MATH_NAME } from "../components/math";
import { INTERNAL_MATH_FENCE_LANG } from "./math-block";

export type MathRoot = MdxJsxFlowElement & { name: typeof EDITOR_MATH_NAME };

const isMath = (node: MdxJsxFlowElement): node is MathRoot => node.name === EDITOR_MATH_NAME;

export const walkOnlyInsideMathCodeFence = (mdxAst: Root) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang !== INTERNAL_MATH_FENCE_LANG) return;
		if (index == null || !parent) return;

		const mathRoot: MdxJsxFlowElement = {
			type: "mdxJsxFlowElement",
			name: EDITOR_MATH_NAME,
			attributes: [],
			children: [],
		};

		const document = fromCodeFenceToCodeBlockDocument(node, {}, { parseLineAnnotations: false });

		document.lines.forEach((line) => {
			const paragraph: Paragraph = {
				type: "paragraph",
				children:
					line.value.length > 0
						? [
								{
									type: "text",
									value: line.value,
								} as Text,
							]
						: [],
			};

			mathRoot.children.push(paragraph);
		});

		parent.children.splice(index, 1, mathRoot);
		return [SKIP, index];
	});
};

export const walkOnlyInsideMath = (mdxAst: Root) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (!isMath(node)) return;
		if (index == null || !parent) return;

		const document = fromMdxFlowElementToCodeDocument(node, {});
		const codeFence = fromCodeBlockDocumentToCodeFence({ ...document, lang: INTERNAL_MATH_FENCE_LANG }, {});

		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};
