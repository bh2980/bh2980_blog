globalThis.__KEYSTATIC_MDX_HOOKS__ = {
	beforeParse(mdx) {
		return mdx;
	},

	afterParse(doc) {
		return doc;
	},

	beforeSerialize(mdxAst) {
		return mdxAst;
	},

	afterSerialize(mdx) {
		return mdx;
	},
};
