import type { Paragraph, PhrasingContent } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../keystatic-annotation-manager";
import { buildAnnotationRegistry } from "../libs";
import type { AnnotationAttr, AnnotationConfig, InlineAnnotation, Line, Range } from "../types";

const { parseParagraphFromLine, buildLineFromParagraph } = __testable__;

const annotationConfig: AnnotationConfig = {
	inlineClass: [{ name: "emphasis", source: "mdast", class: "italic" }],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "strong", source: "mdast", render: "strong" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [],
	lineWrap: [],
};

const registry = buildAnnotationRegistry(annotationConfig);

const inlineWrap = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	attributes: AnnotationAttr[] = [],
): InlineAnnotation => ({
	type: "inlineWrap",
	typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
	tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
	source,
	name,
	range,
	priority,
	attributes,
});

const inlineClass = (
	name: string,
	source: "mdast" | "mdx-text",
	range: Range,
	priority: number,
	attributes: AnnotationAttr[] = [],
): InlineAnnotation => ({
	type: "inlineClass",
	typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
	tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
	source,
	name,
	range,
	priority,
	attributes,
});

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

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

const sortInlineAnnotation = (a: ReturnType<typeof normalizeInlineAnnotation>, b: ReturnType<typeof normalizeInlineAnnotation>) => {
	if (a.range.start !== b.range.start) return a.range.start - b.range.start;
	if (a.range.end !== b.range.end) return a.range.end - b.range.end;
	if (a.name !== b.name) return a.name.localeCompare(b.name);
	if (a.type !== b.type) return a.type.localeCompare(b.type);
	return a.priority - b.priority;
};

describe("parseParagraphFromLine", () => {
	it("텍스트만 있는 Line은 text child만 포함한 paragraph를 만든다", () => {
		const paragraph = parseParagraphFromLine(line("console.log('x')"));

		expect(paragraph.type).toBe("paragraph");
		expect(printParagraph(paragraph)).toBe("console.log('x')");
	});

	it("mdast source inline annotation은 mdast phrasing wrapper로 만든다", () => {
		const paragraph = parseParagraphFromLine(line("abcdef", [inlineWrap("strong", "mdast", { start: 1, end: 4 }, 1)]));

		expect(printParagraph(paragraph)).toBe("a + strong(bcd) + ef");
	});

	it("mdx-text source inline annotation은 mdxJsxTextElement와 attributes를 만든다", () => {
		const paragraph = parseParagraphFromLine(
			line("hello", [inlineWrap("Tooltip", "mdx-text", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])]),
		);

		expect(printParagraph(paragraph)).toBe('Tooltip{content="tip"}(hello)');
	});

	it("중첩 annotation은 range에 맞춰 계층 구조를 만든다", () => {
		const paragraph = parseParagraphFromLine(
			line("abcdefg", [
				inlineWrap("u", "mdx-text", { start: 1, end: 6 }, 2),
				inlineWrap("strong", "mdast", { start: 2, end: 5 }, 1),
			]),
		);

		expect(printParagraph(paragraph)).toBe("a + u(b + strong(cde) + f) + g");
	});

	it("동일 range는 priority 기준으로 중첩 순서를 만든다", () => {
		const paragraph = parseParagraphFromLine(
			line("text", [
				inlineWrap("Tooltip", "mdx-text", { start: 0, end: 4 }, 0),
				inlineWrap("u", "mdx-text", { start: 0, end: 4 }, 4),
			]),
		);

		expect(printParagraph(paragraph)).toBe("Tooltip(u(text))");
	});

	it("buildLineFromParagraph와의 round-trip에서 Line 계약을 유지한다", () => {
		const input = line("123456", [
			inlineClass("emphasis", "mdast", { start: 1, end: 5 }, 0),
			inlineWrap("Tooltip", "mdx-text", { start: 2, end: 4 }, 0, [{ name: "content", value: "x" }]),
		]);

		const paragraph = parseParagraphFromLine(input);
		const reconstructed = buildLineFromParagraph(paragraph, registry);

		expect(reconstructed.value).toBe(input.value);
		expect(reconstructed.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation)).toEqual(
			input.annotations.map(normalizeInlineAnnotation).sort(sortInlineAnnotation),
		);
	});
});
