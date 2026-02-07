import type { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import {
	fromCodeBlockDocumentToCodeFence,
	fromCodeFenceToCodeBlockDocument,
} from "@/libs/annotation/code-block/code-string-converter";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import { isCodeBlock } from "@/libs/annotation/code-block/libs";
import {
	fromCodeBlockDocumentToMdast,
	fromMdastToCodeBlockDocument,
} from "@/libs/annotation/code-block/mdast-document-converter";
import type { AnnotationConfig } from "@/libs/annotation/code-block/types";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";

const walkOnlyInsideCodeFence = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang === "mermaid") return;
		if (index == null || !parent) return;

		const document = fromCodeFenceToCodeBlockDocument(node, config);
		const codeBlockRoot = fromCodeBlockDocumentToMdast(document, config);
		parent.children.splice(index, 1, codeBlockRoot);
		return [SKIP, index];
	});
};

const walkOnlyInsideCodeblock = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (!isCodeBlock(node)) return;
		if (index == null || !parent) return;

		const document = fromMdastToCodeBlockDocument(node, config);
		const codeFence = fromCodeBlockDocumentToCodeFence(document, config);
		parent.children.splice(index, 1, codeFence);
		return [SKIP, index];
	});
};

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse(mdxAst) {
		walkOnlyInsideCodeFence(mdxAst, codeFenceAnnotationConfig);
		findCodeBlockAndMapping(mdxAst);
		return mdxAst;
	},

	beforeSerialize(mdxAst) {
		findCodeBlockAndMapping(mdxAst, { emit: false });
		walkOnlyInsideCodeblock(mdxAst, codeFenceAnnotationConfig);
		return mdxAst;
	},
};
