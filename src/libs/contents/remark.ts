import type { Break, Paragraph, Root, RootContent, Text } from "mdast";
import type {
	MdxJsxAttribute,
	MdxJsxExpressionAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

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

const isText = (node: RootContent): node is Text => node.type === "text";
const isBreak = (node: RootContent): node is Break => node.type === "break";
const isParagraph = (node: RootContent): node is Paragraph => node.type === "paragraph";

const hasChildren = (node: RootContent): node is RootContent & { children: RootContent[] } => {
	return "children" in node;
};

const isMDXJSXTextElement = (node: RootContent): node is MdxJsxTextElement => {
	return node.type === "mdxJsxTextElement";
};

export type Annotation =
	| {
			type: Exclude<RootContent["type"], "mdxJsxTextElement">;
			start: number;
			end: number;
	  }
	| {
			type: "mdxJsxTextElement";
			name: string | null;
			attributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[];
			start: number;
			end: number;
	  };

export function remarkCodeblockAnnotation() {
	return (tree: Root) => {
		visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement) => {
			if (node.name !== "Codeblock") return;

			// extract codeblock code and annotation position information
			const annotaions: Annotation[] = [];
			let code = "";

			function extractTextAndBreak(node: RootContent) {
				if (isText(node)) {
					code += node.value;
					return;
				}

				if (isBreak(node)) {
					code += "\n";
					return;
				}

				if (hasChildren(node)) {
					const start = code.length;

					node.children.forEach((child) => {
						extractTextAndBreak(child);
					});

					if (isMDXJSXTextElement(node)) {
						const annotation: Annotation = {
							type: "mdxJsxTextElement",
							name: node.name,
							attributes: node.attributes,
							start,
							end: code.length,
						};

						annotaions.push(annotation);
					} else {
						const annotation: Annotation = {
							type: node.type as Exclude<RootContent["type"], "mdxJsxTextElement">,
							start,
							end: code.length,
						};

						if (!isParagraph(node)) {
							annotaions.push(annotation);
						}
					}

					return;
				}
			}

			node.children.forEach((child: RootContent) => {
				extractTextAndBreak(child);
			});

			// reset Codeblock
			node.children = [];

			node.attributes = node.attributes.filter((a) => {
				return !(a.type === "mdxJsxAttribute" && (a.name === "code" || a.name === "annotations"));
			});

			const codeAttr: MdxJsxAttribute = {
				type: "mdxJsxAttribute",
				name: "code",
				value: JSON.stringify(code),
			};

			const annoAttr: MdxJsxAttribute = {
				type: "mdxJsxAttribute",
				name: "annotations",
				value: JSON.stringify(annotaions),
			};

			node.attributes.push(codeAttr, annoAttr);
		});
	};
}
