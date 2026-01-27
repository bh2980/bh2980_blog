import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";

const TYPE_TO_STYLE: Record<string, Annotation["type"]> = {
	s: "delete",
	strong: "strong",
	em: "emphasis",
};

export function extractRangesPlainText(
	html: string,
	tagsToTrack = new Set(["strong", "em", "span", "s"]),
) {
	const tpl = document.createElement("template");
	tpl.innerHTML = html;

	let pos = 0;
	const ranges: Annotation[] = [];

	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const v = node.nodeValue ?? "";
			pos += v.length;
			return;
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const name = el.tagName.toLowerCase();
			const component = el.getAttribute("data-component");
			const track = tagsToTrack.has(name) || component === "u" || component === "Tooltip";
			const start = pos;

			el.childNodes.forEach(walk);

			const end = pos;
			if (!track || start >= end) return;

			if (component === "u") {
				ranges.push({
					type: "mdxJsxTextElement",
					name: "u",
					attributes: [],
					start,
					end,
				});
				return;
			}

			if (component === "Tooltip") {
				const content = el.getAttribute("data-content");
				const attributes: MdxJsxAttribute[] = content
					? [{ type: "mdxJsxAttribute", name: "content", value: content }]
					: [];

				ranges.push({
					type: "mdxJsxTextElement",
					name: "Tooltip",
					attributes,
					start,
					end,
				});
				return;
			}

			const mapped = TYPE_TO_STYLE[name];
			if (mapped) {
				ranges.push({
					type: mapped,
					start,
					end,
				});
			}

			return;
		}

		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			node.childNodes.forEach(walk);
		}
	};

	walk(tpl.content);
	return ranges;
}
