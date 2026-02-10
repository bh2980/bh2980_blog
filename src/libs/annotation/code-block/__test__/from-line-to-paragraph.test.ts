import type { Paragraph, PhrasingContent } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeBlockDocumentToMdastTestable } from "../document-to-mdast";
import { __testable__ as libsTestable } from "../libs";
import { __testable__ as fromMdxFlowElementToCodeDocumentTestable } from "../mdast-to-document";
import type { AnnotationAttr, AnnotationConfig, AnnotationEvent, InlineAnnotation, Line, Range } from "../types";

const { fromLineToParagraph } = fromCodeBlockDocumentToMdastTestable;
const { fromParagraphToLine } = fromMdxFlowElementToCodeDocumentTestable;
const { createAnnotationRegistry } = libsTestable;
const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "emphasis", kind: "class" as const, source: "mdast" as const, class: "italic", scopes: ["char"] },
		{ name: "Tooltip", kind: "render" as const, source: "mdx-text" as const, render: "Tooltip", scopes: ["char"] },
		{ name: "strong", kind: "render" as const, source: "mdast" as const, render: "strong", scopes: ["char"] },
		{ name: "u", kind: "render" as const, source: "mdx-text" as const, render: "u", scopes: ["char"] },
	],
};
const registry = createAnnotationRegistry(annotationConfig);

const charRender = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	order: number,
	attributes: AnnotationAttr[] = [],
	render = name,
): InlineAnnotation => ({
	scope: "char",
	source,
	name,
	render,
	range,
	priority,
	order,
	attributes,
});

const charClass = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	order: number,
	attributes: AnnotationAttr[] = [],
	className = name,
): InlineAnnotation => ({
	scope: "char",
	source,
	name,
	class: className,
	range,
	priority,
	order,
	attributes,
});

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });
const composeInlineEventsFixture = (annotations: InlineAnnotation[]): AnnotationEvent[] =>
	annotations
		.flatMap((annotation) => {
			if (annotation.range.start === annotation.range.end) return [];

			return [
				{
					kind: "open" as const,
					pos: annotation.range.start,
					anno: annotation,
				},
				{
					kind: "close" as const,
					pos: annotation.range.end,
					anno: annotation,
				},
			];
		})
		.sort((a, b) => {
			if (a.pos !== b.pos) return a.pos - b.pos;
			if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
			if (a.kind === "open" && a.anno.range.end !== b.anno.range.end) return b.anno.range.end - a.anno.range.end;
			if (a.kind === "close" && a.anno.range.start !== b.anno.range.start)
				return b.anno.range.start - a.anno.range.start;
			return a.anno.order - b.anno.order;
		});

const parse = (input: Line) =>
	fromLineToParagraph(input.value, composeInlineEventsFixture(input.annotations), registry);

const printParagraph = (paragraph: Paragraph): string => {
	const hasChildren = (node: PhrasingContent): node is PhrasingContent & { children: PhrasingContent[] } =>
		"children" in node;

	const print = (node: PhrasingContent): string => {
		if (node.type === "text") {
			return node.value;
		}

		if (node.type === "mdxJsxTextElement") {
			const attrs = node.attributes
				.filter((attr) => attr.type === "mdxJsxAttribute")
				.map((attr) => `${attr.name}=${JSON.stringify(attr.value)}`)
				.join(",");

			const children = node.children.map(print).join(" + ");
			return attrs ? `${node.name}{${attrs}}(${children})` : `${node.name}(${children})`;
		}

		const children = hasChildren(node) ? node.children.map(print).join(" + ") : "";
		return `${node.type}(${children})`;
	};

	return paragraph.children.map(print).join(" + ");
};

const normalizeAttr = (attributes?: AnnotationAttr[]) =>
	(attributes ?? []).map((attr) => ({ name: attr.name, value: attr.value }));

const normalizeInlineAnnotation = (annotation: InlineAnnotation) => ({
	scope: annotation.scope,
	source: annotation.source,
	name: annotation.name,
	range: annotation.range,
	priority: annotation.priority,
	class: annotation.class,
	render: annotation.render,
	attributes: normalizeAttr(annotation.attributes),
});

const sortInlineAnnotation = (
	a: ReturnType<typeof normalizeInlineAnnotation>,
	b: ReturnType<typeof normalizeInlineAnnotation>,
) => {
	if (a.range.start !== b.range.start) return a.range.start - b.range.start;
	if (a.range.end !== b.range.end) return a.range.end - b.range.end;
	if (a.name !== b.name) return a.name.localeCompare(b.name);
	if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
	if ((a.class ?? "") !== (b.class ?? "")) return (a.class ?? "").localeCompare(b.class ?? "");
	if ((a.render ?? "") !== (b.render ?? "")) return (a.render ?? "").localeCompare(b.render ?? "");
	return a.priority - b.priority;
};

describe("fromLineToParagraph", () => {
	it("텍스트만 있는 Line은 text child만 포함한 paragraph를 만든다", () => {
		const paragraph = parse(line("console.log('x')"));

		expect(paragraph.type).toBe("paragraph");
		expect(printParagraph(paragraph)).toBe("console.log('x')");
	});

	it("mdast source inline annotation은 mdast phrasing wrapper로 만든다", () => {
		const paragraph = parse(line("abcdef", [charRender("strong", "mdast", { start: 1, end: 4 }, 1, 0)]));

		expect(printParagraph(paragraph)).toBe("a + strong(bcd) + ef");
	});

	it("mdx-text source inline annotation은 mdxJsxTextElement와 attributes를 만든다", () => {
		const paragraph = parse(
			line("hello", [
				charRender("Tooltip", "mdx-text", { start: 0, end: 5 }, 0, 0, [{ name: "content", value: "tip" }]),
			]),
		);

		expect(printParagraph(paragraph)).toBe('Tooltip{content="tip"}(hello)');
	});

	it("중첩 annotation은 range에 맞춰 계층 구조를 만든다", () => {
		const paragraph = parse(
			line("abcdefg", [
				charRender("u", "mdx-text", { start: 1, end: 6 }, 2, 0),
				charRender("strong", "mdast", { start: 2, end: 5 }, 1, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("a + u(b + strong(cde) + f) + g");
	});

	it("동일 range는 priority가 아니라 order 기준으로 중첩 순서를 만든다", () => {
		const paragraph = parse(
			line("text", [
				charRender("Tooltip", "mdx-text", { start: 0, end: 4 }, 999, 0),
				charRender("u", "mdx-text", { start: 0, end: 4 }, 0, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("Tooltip(u(text))");
	});

	it("동일 단어를 2개 wrapper가 감쌀 때 order 순으로 바깥->안쪽이 결정된다", () => {
		const word = "target";

		const orderAsc = parse(
			line(word, [
				charRender("Tooltip", "mdx-text", { start: 0, end: word.length }, 999, 0),
				charRender("u", "mdx-text", { start: 0, end: word.length }, 0, 1),
			]),
		);
		expect(printParagraph(orderAsc)).toBe("Tooltip(u(target))");

		const orderDesc = parse(
			line(word, [
				charRender("Tooltip", "mdx-text", { start: 0, end: word.length }, 999, 1),
				charRender("u", "mdx-text", { start: 0, end: word.length }, 0, 0),
			]),
		);
		expect(printParagraph(orderDesc)).toBe("u(Tooltip(target))");
	});

	it("zero-length annotation(range start=end)은 무시한다", () => {
		const paragraph = parse(line("abc", [charRender("Tooltip", "mdx-text", { start: 1, end: 1 }, 0, 0)]));
		expect(printParagraph(paragraph)).toBe("abc");
	});

	it("registry에 없는 annotation이 섞여 있어도 알려진 annotation 구조를 깨지 않는다", () => {
		const paragraph = parse(
			line("abcdef", [
				charRender("Tooltip", "mdx-text", { start: 0, end: 6 }, 0, 0),
				charRender("Unknown", "mdx-text", { start: 1, end: 5 }, 99, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("Tooltip(a + bcde) + f");
	});

	it("fromParagraphToLine와의 round-trip에서 Line 계약을 유지한다", () => {
		const input = line("123456", [
			charClass("emphasis", "mdast", { start: 1, end: 5 }, 0, 0, [], "italic"),
			charRender("Tooltip", "mdx-text", { start: 2, end: 4 }, 0, 1, [{ name: "content", value: "x" }], "Tooltip"),
		]);

		const paragraph = parse(input);
		const reconstructed = fromParagraphToLine(paragraph, registry);

		expect(reconstructed.value).toBe(input.value);
		expect(reconstructed.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation)).toEqual(
			input.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation),
		);
	});
});
