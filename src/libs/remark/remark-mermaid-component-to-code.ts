import type { Code, Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";
import { EDITOR_MERMAID_NAME } from "@/keystatic/fields/mdx/components/mermaid";

export const hasChildren = (node: RootContent | Root): node is RootContent & { children: RootContent[] } => {
	return "children" in node;
};

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

	s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
		const codePoint = parseInt(hex, 16);
		return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : _;
	});
	s = s.replace(/&#([0-9]+);/g, (_, dec: string) => {
		const codePoint = parseInt(dec, 10);
		return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : _;
	});

	s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

	return s.trim();
}
