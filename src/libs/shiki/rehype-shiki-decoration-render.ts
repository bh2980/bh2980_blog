import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import { highlight } from "./code-highligher";
import type { LineDecorationPayload, LineWrapperPayload } from "./transformers";

type Meta = Record<string, any>;

function findCodeChild(pre: Element): Element | null {
	const child = pre.children?.find((c) => c?.type === "element" && c.tagName === "code");
	return (child as Element) ?? null;
}

function getLangFromCodeEl(codeEl: Element): string {
	const cn = codeEl.properties?.className;
	const classes = Array.isArray(cn) ? cn : cn ? [cn] : [];
	const lang = classes
		.map(String)
		.find((c) => c.startsWith("language-"))
		?.slice("language-".length);
	return lang || "text";
}

export function rehypeShikiDecorationRender() {
	return async (tree: Root) => {
		visit(tree, "element", (node, index, parent) => {
			if (!parent || index == null) return;
			if (node.tagName !== "pre") return;

			const pre = node as Element;
			const codeEl = findCodeChild(pre);
			if (!codeEl) return;

			let code = hastToString(codeEl);

			code = code.replace(/\r?\n$/, "");

			const lang = getLangFromCodeEl(codeEl);

			const metaStr = (pre.properties?.["data-meta"] ?? codeEl.properties?.["data-meta"]) as string | undefined;

			const decoratonStr = (pre.properties?.["data-decorations"] ?? codeEl.properties?.["data-decorations"]) as
				| string
				| undefined;
			const lineDecorationStr = (
				pre.properties?.["data-line-decorations"] ?? codeEl.properties?.["data-line-decorations"]
			) as string | undefined;
			const lineWrapperStr = (pre.properties?.["data-line-wrappers"] ?? codeEl.properties?.["data-line-wrappers"]) as
				| string
				| undefined;

			const meta: Meta = metaStr ? JSON.parse(metaStr) : {};
			const decorations: DecorationItem[] = decoratonStr ? JSON.parse(decoratonStr) : [];
			const lineDecorations: LineDecorationPayload[] = lineDecorationStr ? JSON.parse(lineDecorationStr) : [];
			const lineWrappers: LineWrapperPayload[] = lineWrapperStr ? JSON.parse(lineWrapperStr) : [];

			const hast = highlight(code, lang, meta, {
				decorations,
				lineDecorations,
				lineWrappers,
			});

			// codeToHast 결과는 Root(fragment). 보통 첫 element가 <pre>
			const newPre = hast.children.find((n) => n.type === "element") as Element;

			// 기존 <pre>를 새 <pre>로 교체
			parent.children[index] = newPre;
		});
	};
}
