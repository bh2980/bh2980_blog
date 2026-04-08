import type { Root } from "mdast";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { replaceMathBlocksWithCodeFences, replaceMathCodeFencesWithBlocks } from "../transforms/math-block";
import {
	convertBodyMdastMarksToMdxJsxTextElement,
	convertBodyMdxJsxTextElementToMdastMarks,
} from "../transforms/mdast-mark-bridge";
import { walkOnlyInsideCodeblock, walkOnlyInsideCodeFence } from "../transforms/mdx-code-block-walk";
import { walkOnlyInsideMath, walkOnlyInsideMathCodeFence } from "../transforms/mdx-math-walk";
import { walkOnlyInsideMermaid, walkOnlyInsideMermaidCodeFence } from "../transforms/mdx-mermaid-walk";
import { normalizeImageAssetUrls } from "../transforms/normalize-image-asset-url";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";

const beforeParse = (mdx: string) => replaceMathBlocksWithCodeFences(mdx);

const afterMarkdownParse = (mdxAst: Root) => {
	normalizeImageAssetUrls(mdxAst);
	walkOnlyInsideMathCodeFence(mdxAst);
	walkOnlyInsideMermaidCodeFence(mdxAst);
	walkOnlyInsideCodeFence(mdxAst, annotationConfig);
	convertBodyMdastMarksToMdxJsxTextElement(mdxAst);
	findCodeBlockAndMapping(mdxAst);
	return mdxAst;
};

const beforeSerialize = (mdxAst: Root) => {
	normalizeImageAssetUrls(mdxAst);
	findCodeBlockAndMapping(mdxAst, { emit: false });
	walkOnlyInsideMath(mdxAst);
	walkOnlyInsideMermaid(mdxAst);
	walkOnlyInsideCodeblock(mdxAst, annotationConfig);
	convertBodyMdxJsxTextElementToMdastMarks(mdxAst);
	return mdxAst;
};

const afterSerialize = (mdx: string) => replaceMathCodeFencesWithBlocks(mdx);

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	beforeParse,
	afterMarkdownParse,
	beforeSerialize,
	afterSerialize,
};
