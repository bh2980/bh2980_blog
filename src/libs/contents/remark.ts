import "server-only";

import type { Paragraph, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

function hasRealText(node: Paragraph): boolean {
	return node.children.some((child) => {
		if (child.type === "text" && child.value.trim()) return true;
		if (child.type === "inlineCode" && child.value.trim()) return true;

		if (child.type === "link") {
			return child.children.some((c) => (c.type === "text" || c.type === "inlineCode") && c.value.trim());
		}

		return false;
	});
}

export function getSafeExcerpt(mdx: string, maxLength = 200) {
	if (!mdx) return "";

	const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(mdx) as Root;

	const paragraphs: Paragraph[] = [];

	for (const node of tree.children) {
		if (node.type !== "paragraph") continue;
		if (!hasRealText(node)) continue;

		paragraphs.push(node);

		if (mdastToString(node).length >= maxLength) break;
	}

	const text = paragraphs
		.map((p) => mdastToString(p))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();

	if (!text) return "";
	if (text.length <= maxLength) return text;

	return `${text.slice(0, maxLength).trim()}`;
}
