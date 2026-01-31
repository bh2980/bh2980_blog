import { findCodeBlockAndMapping } from "./find-codeblock-and-mapping";
import { walkOnlyInsideCodeFence, walkOnlyMermaidCodeFence } from "./parse-annotations";
import { annotationConfig, walkOnlyInsideCodeblock, walkOnlyMermaid } from "./serialize-annotations";

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse(mdxAst) {
		walkOnlyMermaidCodeFence(mdxAst);
		walkOnlyInsideCodeFence(mdxAst, annotationConfig);
		return mdxAst;
	},

	beforeSerialize(mdxAst) {
		findCodeBlockAndMapping(mdxAst);
		walkOnlyMermaid(mdxAst);
		walkOnlyInsideCodeblock(mdxAst, annotationConfig);
		return mdxAst;
	},
};
