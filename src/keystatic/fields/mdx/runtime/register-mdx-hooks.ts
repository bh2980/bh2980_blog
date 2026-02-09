import type { Root } from "mdast";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import {
	convertBodyMdastMarksToMdxJsxTextElement,
	convertBodyMdxJsxTextElementToMdastMarks,
} from "../transforms/mdast-mark-bridge";
import { walkOnlyInsideCodeblock, walkOnlyInsideCodeFence } from "../transforms/mdx-code-block-walk";
import { walkOnlyInsideMermaid, walkOnlyInsideMermaidCodeFence } from "../transforms/mdx-mermaid-walk";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";

const afterMarkdownParse = (mdxAst: Root) => {
	walkOnlyInsideMermaidCodeFence(mdxAst);
	walkOnlyInsideCodeFence(mdxAst, codeFenceAnnotationConfig);
	convertBodyMdastMarksToMdxJsxTextElement(mdxAst);
	findCodeBlockAndMapping(mdxAst);
	return mdxAst;
};

const beforeSerialize = (mdxAst: Root) => {
	findCodeBlockAndMapping(mdxAst, { emit: false });
	walkOnlyInsideMermaid(mdxAst);
	walkOnlyInsideCodeblock(mdxAst, codeFenceAnnotationConfig);
	convertBodyMdxJsxTextElementToMdastMarks(mdxAst);
	return mdxAst;
};

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse,
	beforeSerialize,
};
