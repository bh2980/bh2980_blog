import type { Break, Paragraph, Root, RootContent, Text } from "mdast";
import type {
	MdxJsxAttribute,
	MdxJsxExpressionAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";
import { collectAnnotationRanges } from "@/libs/annotation/collect-annotation-ranges";

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
			const { code, annotations } = collectAnnotationRanges<RootContent, Text>(node.children as RootContent[], {
				isTextNode: isText,
				getText: (current) => current.value,
				isLineBreak: isBreak,
				getChildren: (current) => (hasChildren(current) ? current.children : null),
				getAnnotation: (current, start, end) => {
					if (isMDXJSXTextElement(current)) {
						return {
							type: "mdxJsxTextElement",
							name: current.name,
							attributes: current.attributes,
							start,
							end,
						};
					}

					if (isParagraph(current)) return null;

					return {
						type: current.type as Exclude<RootContent["type"], "mdxJsxTextElement">,
						start,
						end,
					};
				},
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
				value: JSON.stringify(annotations),
			};

			node.attributes.push(codeAttr, annoAttr);
		});
	};
}
