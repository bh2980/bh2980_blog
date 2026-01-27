import type { Break, Paragraph, Root, RootContent, Text } from "mdast";
import type {
	MdxJsxAttribute,
	MdxJsxExpressionAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";

const isText = (node: RootContent): node is Text => node.type === "text";
const isBreak = (node: RootContent): node is Break => node.type === "break";
const isParagraph = (node: RootContent): node is Paragraph => node.type === "paragraph";

export const hasChildren = (node: RootContent | Root): node is RootContent & { children: RootContent[] } => {
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

export function remarkCodeBlockAnnotation() {
	return (tree: Root) => {
		visit(tree, "mdxJsxFlowElement", (node: MdxJsxFlowElement) => {
			if (node.name !== EDITOR_CODE_BLOCK_NAME) return;

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
