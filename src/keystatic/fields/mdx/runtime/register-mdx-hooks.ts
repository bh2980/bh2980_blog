import type { Root } from "mdast";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import {
	convertBodyMdastMarksToMdxJsxTextElement,
	convertBodyMdxJsxTextElementToMdastMarks,
} from "../transforms/mdast-mark-bridge";
import { walkOnlyInsideCodeblock, walkOnlyInsideCodeFence } from "../transforms/mdx-code-block-walk";
import { walkOnlyInsideMermaid, walkOnlyInsideMermaidCodeFence } from "../transforms/mdx-mermaid-walk";
import { normalizeImageAssetUrls } from "../transforms/normalize-image-asset-url";
import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";

const afterMarkdownParse = (mdxAst: Root) => {
	normalizeImageAssetUrls(mdxAst);
	walkOnlyInsideMermaidCodeFence(mdxAst);
	walkOnlyInsideCodeFence(mdxAst, annotationConfig);
	convertBodyMdastMarksToMdxJsxTextElement(mdxAst);
	findCodeBlockAndMapping(mdxAst);
	return mdxAst;
};

const beforeSerialize = (mdxAst: Root) => {
	normalizeImageAssetUrls(mdxAst);
	findCodeBlockAndMapping(mdxAst, { emit: false });
	walkOnlyInsideMermaid(mdxAst);
	walkOnlyInsideCodeblock(mdxAst, annotationConfig);
	convertBodyMdxJsxTextElementToMdastMarks(mdxAst);
	return mdxAst;
};

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse,
	beforeSerialize,
};
