import type { Root } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import {
	buildCodeBlockDocumentFromCodeFence,
	composeCodeFenceFromCodeBlockDocument,
} from "@/libs/annotation/code-block/code-string-converter";
import {
	buildCodeBlockDocumentFromMdast,
	composeCodeBlockRootFromDocument,
} from "@/libs/annotation/code-block/mdast-document-converter";
import type { AnnotationConfig, CodeBlockRoot } from "@/libs/annotation/code-block/types";
import { EDITOR_CODE_BLOCK_NAME } from "../fields/mdx/components/code-block";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";

const walkOnlyInsideCodeFence = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "code", (node, index, parent) => {
		if (node.lang === "mermaid") return;
		if (index == null || !parent) return;

		const document = buildCodeBlockDocumentFromCodeFence(node, config);
		const codeBlockRoot = composeCodeBlockRootFromDocument(document, config);
		parent.children.splice(index, 1, codeBlockRoot);
		return [SKIP, index];
	});
};

const walkOnlyInsideCodeblock = (mdxAst: Root, config: AnnotationConfig) => {
	visit(mdxAst, "mdxJsxFlowElement", (node, index, parent) => {
		if (node.name !== EDITOR_CODE_BLOCK_NAME) return;
		if (index == null || !parent) return;

		const document = buildCodeBlockDocumentFromMdast(node as CodeBlockRoot, config);
		const codeFence = composeCodeFenceFromCodeBlockDocument(document, config);
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
