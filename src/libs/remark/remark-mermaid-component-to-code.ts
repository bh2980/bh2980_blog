import type { Code, Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";
import { EDITOR_MERMAID_NAME } from "@/keystatic/fields/mdx/components/mermaid";
import { hasChildren } from "./remark-code-block-annotation";

export const remarkMermaidComponentToCode =
	() =>
	(tree: Root): void => {
		visit(tree, "mdxJsxFlowElement", (node, index, parent) => {
			if (!parent || index == null) return;

			if (node.name !== EDITOR_MERMAID_NAME) return;

			const raw = collectText(node?.children ?? []);
			const diagram = decodeMermaidLikeYourInput(raw);

			const codeNode: Code = {
				type: "code",
				lang: "mermaid",
				value: diagram,
			};

			if (hasChildren(parent)) {
				parent.children[index] = codeNode;
			}
		});
	};

function collectText(children: RootContent[]): string {
	let out = "";
	for (const c of children) {
		if (!c) continue;

		if ((c as { type?: string }).type === "text") {
			out += (c as { value?: string }).value ?? "";
			continue;
		}

		if (hasChildren(c)) {
			const nested = c.children;
			if (Array.isArray(nested)) out += collectText(nested);
		}
	}
	return out;
}

function decodeMermaidLikeYourInput(input: string): string {
	let s = input.replace(/\r\n/g, "\n");

	s = s.replace(/\\\s*\n/g, "\n");

	s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
	s = s.replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));

	s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

	return s.trim();
}
