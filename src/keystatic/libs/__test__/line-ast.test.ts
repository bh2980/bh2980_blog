import type { PhrasingContent } from "mdast";
import { describe, expect, it } from "vitest";
import type { AnnotationEvent, LineAnnotation } from "../parse-annotations";
import { __testable__ } from "../parse-annotations";
import type { AnnotationRegistry } from "../serialize-annotations";
import { ANNOTATION_TAG_BY_TYPE, AnnotationType } from "../serialize-annotations";

const { buildEvents, buildLineAst } = __testable__;

const registry: AnnotationRegistry = new Map([
	[
		"strong",
		{
			type: AnnotationType.DECORATION,
			tag: ANNOTATION_TAG_BY_TYPE[AnnotationType.DECORATION],
			name: "strong",
			source: "mdast",
			priority: 0,
			class: "strong",
		},
	],
	[
		"emphasis",
		{
			type: AnnotationType.DECORATION,
			tag: ANNOTATION_TAG_BY_TYPE[AnnotationType.DECORATION],
			name: "emphasis",
			source: "mdast",
			priority: 1,
			class: "emphasis",
		},
	],
	[
		"delete",
		{
			type: AnnotationType.DECORATION,
			tag: ANNOTATION_TAG_BY_TYPE[AnnotationType.DECORATION],
			name: "delete",
			source: "mdast",
			priority: 2,
			class: "delete",
		},
	],
	[
		"u",
		{
			type: AnnotationType.DECORATION,
			tag: ANNOTATION_TAG_BY_TYPE[AnnotationType.DECORATION],
			name: "u",
			source: "mdx-text",
			priority: 3,
			class: "u",
		},
	],
	[
		"Tooltip",
		{
			type: AnnotationType.MARK,
			tag: ANNOTATION_TAG_BY_TYPE[AnnotationType.MARK],
			name: "Tooltip",
			source: "mdx-text",
			priority: 0,
			render: "Tooltip",
		},
	],
]);

type AnnotationInput = {
	type: AnnotationType;
	name: string;
	range: LineAnnotation["range"];
	priority?: number;
	attributes?: LineAnnotation["attributes"];
	class?: string;
	render?: string;
};

const anno = (partial: AnnotationInput): LineAnnotation => {
	const base = {
		type: partial.type,
		tag: ANNOTATION_TAG_BY_TYPE[partial.type],
		name: partial.name,
		range: partial.range,
		priority: partial.priority ?? 0,
		attributes: partial.attributes,
	};

	if (partial.type === AnnotationType.MARK || partial.type === AnnotationType.BLOCK) {
		return { ...base, render: partial.render ?? "render" };
	}

	return { ...base, class: partial.class ?? "class" };
};

const hasChildren = (node: PhrasingContent): node is PhrasingContent & { children: PhrasingContent[] } =>
	"children" in node;

const printAst = (nodes: PhrasingContent[]) => {
	const printNodes = (items: PhrasingContent[]): string => items.map(printNode).join(" + ");

	const printNode = (node: PhrasingContent): string => {
		if (node.type === "text") return node.value ?? "";

		if (node.type === "mdxJsxTextElement") {
			const attrs =
				node.attributes?.map((attr) => {
					if (attr.type === "mdxJsxAttribute") {
						return `${attr.name}=${JSON.stringify(attr.value)}`;
					}
					return `{${attr.value}}`;
				}) ?? [];
			const childrenText = printNodes(node.children ?? []);
			const attrText = attrs.join(", ");
			if (attrText && childrenText) return `${node.name}(${attrText}, ${childrenText})`;
			if (attrText) return `${node.name}(${attrText})`;
			return `${node.name}(${childrenText})`;
		}

		const childrenText = hasChildren(node) ? printNodes(node.children ?? []) : "";
		return `${node.type}(${childrenText})`;
	};

	return printNodes(nodes);
};

describe("buildLineAst", () => {
	it("annotation 없음", () => {
		const line = "console.log('x')";
		const events: AnnotationEvent[] = buildEvents([]);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("console.log('x')");
	});

	it("단일 mdast wrapper", () => {
		const line = "abcdef";
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "strong", range: { start: 1, end: 4 }, priority: 0 }),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("a + strong(bcd) + ef");
	});

	it("단일 mdx-text wrapper + attributes", () => {
		const line = "hello world";
		const annotations = [
			anno({
				type: AnnotationType.MARK,
				name: "Tooltip",
				range: { start: 0, end: 5 },
				priority: 0,
				attributes: [{ name: "content", value: "test" }],
			}),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe('Tooltip(content="\\"test\\"", hello) +  world');
	});

	it("중첩(well-nested)", () => {
		const line = "0123456789";
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "u", range: { start: 2, end: 8 }, priority: 0 }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 3, end: 6 }, priority: 0 }),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("01 + u(2 + Tooltip(345) + 67) + 89");
	});

	it("같은 start, 다른 end", () => {
		const line = "abcdefgh";
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "u", range: { start: 1, end: 7 }, priority: 0 }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 1, end: 4 }, priority: 0 }),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("a + u(Tooltip(bcd) + efg) + h");
	});

	it("같은 end, 다른 start", () => {
		const line = "abcdefgh";
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "u", range: { start: 1, end: 7 }, priority: 0 }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 3, end: 7 }, priority: 0 }),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("a + u(bc + Tooltip(defg)) + h");
	});

	it("동일 구간 2개에서 priority로 중첩 결정", () => {
		const line = "abcdef";
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "u", range: { start: 1, end: 4 }, priority: 0 }),
			anno({ type: AnnotationType.DECORATION, name: "strong", range: { start: 1, end: 4 }, priority: 1 }),
		];
		const events = buildEvents(annotations);
		const ast = buildLineAst(line, events, registry);
		expect(printAst(ast)).toBe("a + u(strong(bcd)) + ef");
	});
});
