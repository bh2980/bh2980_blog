import type { Element, Root } from "hast";
import type { ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";

export type Meta = Record<string, any>;

export const addMetaToPre = (code: string, meta: Meta): ShikiTransformer => ({
	pre(node: Element) {
		if (!node.properties) node.properties = {};
		const preProperties = node.properties;

		preProperties.code = code;

		for (const [key, value] of Object.entries(meta)) {
			preProperties[key] = value;
		}
	},
});

const DENY_PROPS = new Set([
	"dangerouslySetInnerHTML",
	"children",
	"ref",
	"key",
	"__proto__",
	"prototype",
	"constructor",
	"srcDoc", // 필요하면 추가
]);
// TODO: deny list로 props 할당 제한을 통한 보안조치 필요
export const replaceToRenderTag = (): ShikiTransformer => ({
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
