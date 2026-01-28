import { annotationConfig, walkOnlyInsideCodeblock } from "./annotations";

globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	beforeParse(mdx) {
		return mdx;
	},

	afterParse(doc) {
		return doc;
	},

	beforeSerialize(mdxAst) {
		console.group("beforeSerialize");

		walkOnlyInsideCodeblock(mdxAst, annotationConfig);

		console.groupEnd();
		return mdxAst;
	},

	afterSerialize(mdx) {
		return mdx;
	},
};
