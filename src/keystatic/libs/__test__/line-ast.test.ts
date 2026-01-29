import { describe, expect, it } from "vitest";
import type { AnnotationEvent, LineAnnotation } from "../parse-annotations";
import { buildEvents, buildLineAst } from "../parse-annotations";
import type { AnnotationSource } from "../serialize-annotations";
import { AnnotationType } from "../serialize-annotations";

type AnnotationRegistryItem = {
	type: AnnotationType;
	name: string;
	source: AnnotationSource;
	priority: number;
};

type Registry = Map<string, AnnotationRegistryItem>;

const registry: Registry = new Map([
	["strong", { type: AnnotationType.DECORATION, name: "strong", source: "mdast", priority: 0 }],
	["emphasis", { type: AnnotationType.DECORATION, name: "emphasis", source: "mdast", priority: 1 }],
	["delete", { type: AnnotationType.DECORATION, name: "delete", source: "mdast", priority: 2 }],
	["u", { type: AnnotationType.DECORATION, name: "u", source: "mdx-text", priority: 3 }],
	["Tooltip", { type: AnnotationType.MARK, name: "Tooltip", source: "mdx-text", priority: 0 }],
]);

const anno = (partial: Omit<LineAnnotation, "priority"> & { priority?: number }): LineAnnotation => ({
	priority: 0,
	...partial,
});

const printAst = (nodes: any[]) => {
	const printNodes = (items: any[]): string => items.map(printNode).join(" + ");

	const printNode = (node: any): string => {
		if (!node) return "";
		if (node.type === "text") return node.value ?? "";

		if (node.type === "mdxJsxTextElement") {
			const attrs =
				node.attributes?.map((attr: { name: string; value: unknown }) => {
					if (typeof attr.value === "string") {
						return `${attr.name}=${JSON.stringify(attr.value)}`;
					}
					return `${attr.name}=${JSON.stringify(attr.value)}`;
				}) ?? [];
			const childrenText = printNodes(node.children ?? []);
			const attrText = attrs.join(", ");
			if (attrText && childrenText) return `${node.name}(${attrText}, ${childrenText})`;
			if (attrText) return `${node.name}(${attrText})`;
			return `${node.name}(${childrenText})`;
		}

		const childrenText = printNodes(node.children ?? []);
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
