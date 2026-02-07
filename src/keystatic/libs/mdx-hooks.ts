import type { Root } from "mdast";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";
import {
	convertBodyMdastMarksToMdxJsxTextElement,
	convertBodyMdxJsxTextElementToMdastMarks,
} from "./mdast-mark-bridge";
import { walkOnlyInsideCodeFence, walkOnlyInsideCodeblock } from "./mdx-code-block-walk";

const afterMarkdownParse = (mdxAst: Root) => {
	walkOnlyInsideCodeFence(mdxAst, codeFenceAnnotationConfig);
	convertBodyMdastMarksToMdxJsxTextElement(mdxAst);
	findCodeBlockAndMapping(mdxAst);
	return mdxAst;
};

const beforeSerialize = (mdxAst: Root) => {
	findCodeBlockAndMapping(mdxAst, { emit: false });
	walkOnlyInsideCodeblock(mdxAst, codeFenceAnnotationConfig);
	convertBodyMdxJsxTextElementToMdastMarks(mdxAst);
	return mdxAst;
};

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse,
	beforeSerialize,
};
