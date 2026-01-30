import { walkOnlyInsideCodeFence } from "./parse-annotations";
import { annotationConfig, walkOnlyInsideCodeblock } from "./serialize-annotations";

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	afterMarkdownParse(mdxAst) {
		walkOnlyInsideCodeFence(mdxAst, annotationConfig);
		return mdxAst;
	},

	beforeSerialize(mdxAst) {
		walkOnlyInsideCodeblock(mdxAst, annotationConfig);
		return mdxAst;
	},
};
