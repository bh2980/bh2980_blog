import { annotationConfig, walkOnlyInsideCodeblock } from "./serialize-annotations";

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	beforeParse(mdxAst) {
		return mdxAst;
	},

	afterParse(doc) {
		return doc;
	},

	beforeSerialize(mdxAst) {
		walkOnlyInsideCodeblock(mdxAst, annotationConfig);

		return mdxAst;
	},

	afterSerialize(mdx) {
		return mdx;
	},
};
