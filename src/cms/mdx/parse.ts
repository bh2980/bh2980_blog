import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

export const parseMdxAst = (body: string): Root => {
	return unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkMath).parse(body) as Root;
};
