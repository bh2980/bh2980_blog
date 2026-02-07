import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { SKIP, visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "@/libs/annotation/code-block/document-to-code-fence";
import { fromCodeBlockDocumentToMdast } from "@/libs/annotation/code-block/document-to-mdast";
import { fromMdastToCodeBlockDocument } from "@/libs/annotation/code-block/mdast-to-document";
import type { AnnotationConfig, CodeBlockRoot } from "@/libs/annotation/code-block/types";

const isCodeBlock = (node: MdxJsxFlowElement): node is CodeBlockRoot => node.name === EDITOR_CODE_BLOCK_NAME;

export const walkOnlyInsideCodeFence = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang === "mermaid") return;
		if (index == null || !parent) return;

		const document = fromCodeFenceToCodeBlockDocument(node, config);
		const codeBlockRoot = fromCodeBlockDocumentToMdast(document, config);
		parent.children.splice(index, 1, codeBlockRoot);
		return [SKIP, index];
	});
};

export const walkOnlyInsideCodeblock = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (!isCodeBlock(node)) return;
		if (index == null || !parent) return;

		const document = fromMdastToCodeBlockDocument(node, config);
		const codeFence = fromCodeBlockDocumentToCodeFence(document, config);
		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};

