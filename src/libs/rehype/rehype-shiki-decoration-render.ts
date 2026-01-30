import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Highlighter, ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";
import type { ShikiDecoration } from "../remark/remark-annotation-to-decoration";

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

const addMetaToPre = (meta: Meta): ShikiTransformer => ({
	pre(node: Element) {
		if (!node.properties) node.properties = {};
		const preProperties = node.properties;

		for (const [key, value] of Object.entries(meta)) {
			preProperties[`data-${key.toLowerCase()}`] = value;
		}
	},
});

const replaceToRenderTag = (): ShikiTransformer => ({
	root(rootNode: Root) {
		visit(rootNode, "element", (el) => {
			const p = el.properties ?? {};

			const render = p["data-anno-render"] ?? p.dataAnnoRender;

			if (!render) return;

			el.tagName = String(render);

			for (const [k, v] of Object.entries(p)) {
				if (typeof k === "string") {
					const isRender = k === "data-anno-render";
					const isDash = k.startsWith("data-anno-");
					if (!isDash || isRender) continue;

					// prop 이름 만들기
					const propName = k.slice("data-anno-".length);

					// 값 파싱(문자열일 때만 JSON.parse 시도)
					let parsed = v;
					if (typeof v === "string") {
						try {
							parsed = JSON.parse(v);
						} catch {
							parsed = v; // JSON 아닌 경우 그대로
						}
					}

					p[propName] = parsed;
				}
			}

			for (const k of Object.keys(p)) {
				if (k.startsWith("data-anno-")) delete p[k];
			}
		});
	},
});

export function rehypeShikiDecorationRender(opts: { highlighter: Highlighter; theme: string }) {
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

			const meta: Meta = metaStr ? JSON.parse(metaStr) : {};
			const decorations: ShikiDecoration[] = decoratonStr ? JSON.parse(decoratonStr) : [];

			const hast = opts.highlighter.codeToHast(code, {
				lang,
				theme: opts.theme,
				decorations,
				transformers: [replaceToRenderTag(), addMetaToPre(meta)],
			});

			// codeToHast 결과는 Root(fragment). 보통 첫 element가 <pre>
			const newPre = hast.children.find((n) => n.type === "element") as Element;

			// 기존 <pre>를 새 <pre>로 교체
			parent.children[index] = newPre;
		});
	};
}
