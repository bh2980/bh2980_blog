import type { Element } from "hast";
import type { ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";

export type Meta = Record<string, any>;
export type LineDecorationPayload = {
	type: "lineClass";
	name: string;
	range: { start: number; end: number };
	class: string;
};
export type LineWrapperPayload = {
	type: "lineWrap";
	name: string;
	range: { start: number; end: number };
	order: number;
	render: string;
	attributes?: { name: string; value: unknown }[];
};

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

export const addLineDecorations = (lineDecorations: LineDecorationPayload[] = []): ShikiTransformer => {
	const normalized = lineDecorations
		.map((decoration) => ({
			...decoration,
			class: decoration.class.trim(),
		}))
		.filter((decoration) => decoration.range.start < decoration.range.end && decoration.class.length > 0);

	return {
		line(lineEl: Element, lineNumber: number) {
			const lineIndex = lineNumber - 1;
			const classNames = normalized
				.filter((decoration) => decoration.range.start <= lineIndex && lineIndex < decoration.range.end)
				.map((decoration) => decoration.class);
			if (classNames.length === 0) return;

			if (!lineEl.properties) {
				lineEl.properties = {};
			}

			const existing = lineEl.properties.className;
			const existingList = Array.isArray(existing)
				? existing.map(String)
				: typeof existing === "string"
					? [existing]
					: [];
			lineEl.properties.className = [...existingList, ...classNames];
		},
	};
};

type ElementPathItem = {
	node: Element;
	indexInParent: number;
};

type HastPropertyValue = string | number | boolean | Array<string | number> | null | undefined;

const toHastPropertyValue = (value: unknown): HastPropertyValue => {
	if (value == null) return value;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
		return value as Array<string | number>;
	}
	return JSON.stringify(value);
};

const getTopLevelLineElements = (codeEl: Element) =>
	codeEl.children.filter((node): node is Element => node.type === "element");

const findPathToNode = (root: Element, target: Element): ElementPathItem[] | null => {
	const walk = (current: Element, path: ElementPathItem[]): ElementPathItem[] | null => {
		if (current === target) return path;

		for (let index = 0; index < current.children.length; index += 1) {
			const child = current.children[index];
			if (child.type !== "element") continue;
			const next = walk(child, [...path, { node: child, indexInParent: index }]);
			if (next) return next;
		}

		return null;
	};

	return walk(root, [{ node: root, indexInParent: -1 }]);
};

const wrapRangeByLines = (
	root: Element,
	startLine: Element,
	endLine: Element,
	tagName: string,
	properties: Record<string, HastPropertyValue>,
) => {
	const startPath = findPathToNode(root, startLine);
	const endPath = findPathToNode(root, endLine);
	if (!startPath || !endPath) return;

	let lcaPathIndex = 0;
	while (
		lcaPathIndex < startPath.length &&
		lcaPathIndex < endPath.length &&
		startPath[lcaPathIndex].node === endPath[lcaPathIndex].node
	) {
		lcaPathIndex += 1;
	}
	lcaPathIndex -= 1;
	if (lcaPathIndex < 0) return;

	if (startLine === endLine && lcaPathIndex === startPath.length - 1) {
		lcaPathIndex -= 1;
		if (lcaPathIndex < 0) return;
	}

	const lca = startPath[lcaPathIndex].node;
	const startEntry = startPath[lcaPathIndex + 1];
	const endEntry = endPath[lcaPathIndex + 1];
	if (!startEntry || !endEntry) return;

	const from = Math.min(startEntry.indexInParent, endEntry.indexInParent);
	const to = Math.max(startEntry.indexInParent, endEntry.indexInParent);
	const targetChildren = lca.children.slice(from, to + 1);
	if (targetChildren.length === 0) return;

	const wrapper: Element = {
		type: "element",
		tagName,
		properties,
		children: targetChildren,
	};

	lca.children.splice(from, to - from + 1, wrapper);
};

export const addLineWrappers = (lineWrappers: LineWrapperPayload[] = []): ShikiTransformer => {
	const normalized = lineWrappers
		.map((wrapper) => ({
			...wrapper,
			render: wrapper.render.trim(),
			attributes: (wrapper.attributes ?? []).filter((attr) => typeof attr.name === "string" && attr.name.length > 0),
		}))
		.filter((wrapper) => wrapper.range.start < wrapper.range.end && wrapper.render.length > 0);

	return {
		code(codeEl: Element) {
			const lines = getTopLevelLineElements(codeEl);

			for (const wrapper of normalized) {
				const { start, end } = wrapper.range;
				if (start < 0 || end > lines.length) continue;

				const startLine = lines[start];
				const endLine = lines[end - 1];
				if (!startLine || !endLine) continue;

				const properties: Record<string, HastPropertyValue> = {};
				for (const attribute of wrapper.attributes) {
					if (DENY_PROPS.has(attribute.name)) continue;
					properties[attribute.name] = toHastPropertyValue(attribute.value);
				}
				properties["data-code-block-wrapper"] = "true";

				wrapRangeByLines(codeEl, startLine, endLine, wrapper.render, properties);
			}
		},
	};
};

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

const RENDER_TAG_RE = /^[A-Za-z][A-Za-z0-9._-]*$/;
export const convertInlineAnnoToRenderTag = (): ShikiTransformer => ({
	code(codeEl: Element) {
		visit(codeEl, "element", (el) => {
			el.properties ??= {};
			const p = el.properties;

			const render = p["data-anno-render"] ?? p.dataAnnoRender;

			if (!render) return;
			if (typeof render !== "string" || !RENDER_TAG_RE.test(render)) return;

			el.tagName = render;

			for (const [k, v] of Object.entries(p)) {
				if (typeof k === "string") {
					const isRender = k === "data-anno-render";
					const isDash = k.startsWith("data-anno-");
					if (!isDash || isRender) continue;

					// prop 이름 만들기
					const propName = k.slice("data-anno-".length);
					if (!propName || DENY_PROPS.has(propName)) continue;

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
