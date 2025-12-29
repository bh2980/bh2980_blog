import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";
import { visit } from "unist-util-visit";

function createMdxAttributeTransformer(componentName: string) {
	return (tree: any) => {
		visit(tree, "mdxJsxFlowElement", (node) => {
			if (node.name !== componentName) return;

			const mdxAttrIndex = node.attributes.findIndex((attr: any) => attr.name === "mdx");

			if (mdxAttrIndex !== -1) {
				const mdxContent = node.attributes[mdxAttrIndex].value;

				if (typeof mdxContent === "string") {
					const tempTree = fromMarkdown(mdxContent, {
						extensions: [mdxjs()],
						mdastExtensions: [mdxFromMarkdown()],
					});

					node.children = tempTree.children;
					node.attributes.splice(mdxAttrIndex, 1);
				}
			}
		});
	};
}

export const remarkCodeWithTabs = createMdxAttributeTransformer("CodeWithTabs");
export const remarkCodeWithTooltips = createMdxAttributeTransformer("CodeWithTooltips");
