import type { Image, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";

const createStringAttr = (name: string, value: string): MdxJsxAttribute => ({
	type: "mdxJsxAttribute",
	name,
	value,
});

const toMdxImageNode = (node: Image): MdxJsxTextElement => {
	const attributes: MdxJsxAttribute[] = [createStringAttr("src", node.url), createStringAttr("alt", node.alt ?? "")];

	if (node.title) {
		attributes.push(createStringAttr("title", node.title));
	}

	return {
		type: "mdxJsxTextElement",
		name: "img",
		attributes,
		children: [],
	};
};

export const remarkImageToMdx = () => {
	return (tree: Parent) => {
		visit(tree, "image", (node: Image, index, parent) => {
			if (index == null || !parent || !("children" in parent) || !Array.isArray(parent.children)) return;

			parent.children[index] = toMdxImageNode(node) as RootContent;
		});
	};
};

export const __testable__ = {
	toMdxImageNode,
};
