import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import { collectAnnotationRanges } from "@/libs/annotation/collect-annotation-ranges";

type InlineStyleType = "strong" | "emphasis" | "delete";

const TYPE_TO_STYLE: Record<string, InlineStyleType> = {
	s: "delete",
	strong: "strong",
	em: "emphasis",
};

export function extractRangesPlainText(html: string, tagsToTrack = new Set(["strong", "em", "span", "s"])) {
	const tpl = document.createElement("template");
	tpl.innerHTML = html;

	const { annotations } = collectAnnotationRanges<Node, Text>(Array.from(tpl.content.childNodes) as Node[], {
		isTextNode: (node): node is Text => node.nodeType === Node.TEXT_NODE,
		getText: (node) => node.nodeValue ?? "",
		isLineBreak: (node) => node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "br",
		getChildren: (node) => {
			if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
				return Array.from(node.childNodes) as Node[];
			}
			return null;
		},
		getAnnotation: (node, start, end) => {
			if (node.nodeType !== Node.ELEMENT_NODE) return null;

			const el = node as Element;
			const name = el.tagName.toLowerCase();
			const component = el.getAttribute("data-component");
			const track = tagsToTrack.has(name) || component === "u" || component === "Tooltip";
			if (!track) return null;

			if (component === "u") {
				return {
					type: "mdxJsxTextElement",
					name: "u",
					attributes: [],
					start,
					end,
				};
			}

			if (component === "Tooltip") {
				const content = el.getAttribute("data-content");
				const attributes: MdxJsxAttribute[] = content
					? [{ type: "mdxJsxAttribute", name: "content", value: content }]
					: [];

				return {
					type: "mdxJsxTextElement",
					name: "Tooltip",
					attributes,
					start,
					end,
				};
			}

			const mapped = TYPE_TO_STYLE[name];
			if (!mapped) return null;

			return {
				type: mapped,
				start,
				end,
			};
		},
	});

	return annotations;
}
