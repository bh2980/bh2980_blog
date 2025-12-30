import "server-only";

import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

export function getSafeExcerpt(mdx: string, maxLength = 150) {
	if (!mdx) return "";

	const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(mdx) as any;

	const text = (tree.children ?? [])
		.filter((n: any) => n.type === "paragraph")
		.map((n: any) => mdastToString(n))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= maxLength) return text;

	return text.slice(0, maxLength).trim() + "…";
}
