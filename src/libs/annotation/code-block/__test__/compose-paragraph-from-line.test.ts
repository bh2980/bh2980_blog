import type { Paragraph, PhrasingContent } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../mdast-document-converter";
import type {
	AnnotationAttr,
	AnnotationEvent,
	AnnotationRegistry,
	InlineAnnotation,
	Line,
	Range,
} from "../types";

const { composeParagraphFromLine, buildLineFromParagraph } = __testable__;

const registry: AnnotationRegistry = new Map([
	[
		"emphasis",
		{
			name: "emphasis",
			source: "mdast",
			class: "italic",
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
			priority: 0,
		},
	],
	[
		"Tooltip",
		{
			name: "Tooltip",
			source: "mdx-text",
			render: "Tooltip",
			type: "inlineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
			priority: 0,
		},
	],
	[
		"strong",
		{
			name: "strong",
			source: "mdast",
			render: "strong",
			type: "inlineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
			priority: 1,
		},
	],
	[
		"u",
		{
			name: "u",
			source: "mdx-text",
			render: "u",
			type: "inlineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
			priority: 2,
		},
	],
]);

const inlineWrap = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	order: number,
	attributes: AnnotationAttr[] = [],
): InlineAnnotation => ({
	type: "inlineWrap",
	typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
	tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
	source,
	name,
	range,
	priority,
	order,
	attributes,
});

const inlineClass = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	order: number,
	attributes: AnnotationAttr[] = [],
): InlineAnnotation => ({
	type: "inlineClass",
	typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
	tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
	source,
	name,
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
			if (a.kind === "close" && a.anno.range.start !== b.anno.range.start) return b.anno.range.start - a.anno.range.start;
			if (a.anno.typeId !== b.anno.typeId) return a.anno.typeId - b.anno.typeId;
			return a.anno.order - b.anno.order;
		});

const parse = (input: Line) => composeParagraphFromLine(input.value, composeInlineEventsFixture(input.annotations), registry);

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
	type: annotation.type,
	source: annotation.source,
	name: annotation.name,
	range: annotation.range,
	priority: annotation.priority,
	attributes: normalizeAttr(annotation.attributes),
});

const sortInlineAnnotation = (
	a: ReturnType<typeof normalizeInlineAnnotation>,
	b: ReturnType<typeof normalizeInlineAnnotation>,
) => {
	if (a.range.start !== b.range.start) return a.range.start - b.range.start;
	if (a.range.end !== b.range.end) return a.range.end - b.range.end;
	if (a.name !== b.name) return a.name.localeCompare(b.name);
	if (a.type !== b.type) return a.type.localeCompare(b.type);
	return a.priority - b.priority;
};

describe("composeParagraphFromLine", () => {
	it("텍스트만 있는 Line은 text child만 포함한 paragraph를 만든다", () => {
		const paragraph = parse(line("console.log('x')"));

		expect(paragraph.type).toBe("paragraph");
		expect(printParagraph(paragraph)).toBe("console.log('x')");
	});

	it("mdast source inline annotation은 mdast phrasing wrapper로 만든다", () => {
		const paragraph = parse(line("abcdef", [inlineWrap("strong", "mdast", { start: 1, end: 4 }, 1, 0)]));

		expect(printParagraph(paragraph)).toBe("a + strong(bcd) + ef");
	});

	it("mdx-text source inline annotation은 mdxJsxTextElement와 attributes를 만든다", () => {
		const paragraph = parse(
			line("hello", [inlineWrap("Tooltip", "mdx-text", { start: 0, end: 5 }, 0, 0, [{ name: "content", value: "tip" }])]),
		);

		expect(printParagraph(paragraph)).toBe('Tooltip{content="tip"}(hello)');
	});

	it("중첩 annotation은 range에 맞춰 계층 구조를 만든다", () => {
		const paragraph = parse(
			line("abcdefg", [
				inlineWrap("u", "mdx-text", { start: 1, end: 6 }, 2, 0),
				inlineWrap("strong", "mdast", { start: 2, end: 5 }, 1, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("a + u(b + strong(cde) + f) + g");
	});

	it("동일 range는 priority가 아니라 order 기준으로 중첩 순서를 만든다", () => {
		const paragraph = parse(
			line("text", [
				inlineWrap("Tooltip", "mdx-text", { start: 0, end: 4 }, 999, 0),
				inlineWrap("u", "mdx-text", { start: 0, end: 4 }, 0, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("Tooltip(u(text))");
	});

	it("동일 단어를 2개 wrapper가 감쌀 때 order 순으로 바깥->안쪽이 결정된다", () => {
		const word = "target";

		const orderAsc = parse(
			line(word, [
				inlineWrap("Tooltip", "mdx-text", { start: 0, end: word.length }, 999, 0),
				inlineWrap("u", "mdx-text", { start: 0, end: word.length }, 0, 1),
			]),
		);
		expect(printParagraph(orderAsc)).toBe("Tooltip(u(target))");

		const orderDesc = parse(
			line(word, [
				inlineWrap("Tooltip", "mdx-text", { start: 0, end: word.length }, 999, 1),
				inlineWrap("u", "mdx-text", { start: 0, end: word.length }, 0, 0),
			]),
		);
		expect(printParagraph(orderDesc)).toBe("u(Tooltip(target))");
	});

	it("zero-length annotation(range start=end)은 무시한다", () => {
		const paragraph = parse(line("abc", [inlineWrap("Tooltip", "mdx-text", { start: 1, end: 1 }, 0, 0)]));
		expect(printParagraph(paragraph)).toBe("abc");
	});

	it("registry에 없는 annotation이 섞여 있어도 알려진 annotation 구조를 깨지 않는다", () => {
		const paragraph = parse(
			line("abcdef", [
				inlineWrap("Tooltip", "mdx-text", { start: 0, end: 6 }, 0, 0),
				inlineWrap("Unknown", "mdx-text", { start: 1, end: 5 }, 99, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("Tooltip(a + bcde) + f");
	});

	it("buildLineFromParagraph와의 round-trip에서 Line 계약을 유지한다", () => {
		const input = line("123456", [
			inlineClass("emphasis", "mdast", { start: 1, end: 5 }, 0, 0),
			inlineWrap("Tooltip", "mdx-text", { start: 2, end: 4 }, 0, 1, [{ name: "content", value: "x" }]),
		]);

		const paragraph = parse(input);
		const reconstructed = buildLineFromParagraph(paragraph, registry);

		expect(reconstructed.value).toBe(input.value);
		expect(reconstructed.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation)).toEqual(
			input.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation),
		);
	});
});
