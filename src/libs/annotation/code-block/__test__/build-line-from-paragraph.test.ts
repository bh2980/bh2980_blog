import type { Paragraph } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../mdast-document-converter";
import { __testable__ as libsTestable } from "../libs";
import type { AnnotationAttr, AnnotationConfig, InlineAnnotation, Range } from "../types";

const { buildLineFromParagraph } = __testable__;
const { createAnnotationRegistry } = libsTestable;

const annotationConfig: AnnotationConfig = {
	inlineClass: [
		{ name: "strong", source: "mdast", class: "font-bold" },
		{ name: "emphasis", source: "mdast", class: "italic" },
	],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [{ name: "LineBadge", source: "mdx-text", class: "line-badge" }],
	lineWrap: [{ name: "Collapsible", source: "mdx-flow", render: "Collapsible" }],
};

const registry = createAnnotationRegistry(annotationConfig);

const text = (value: string) => ({ type: "text", value });
const paragraph = (children: any[]): Paragraph => ({ type: "paragraph", children });
const inline = (name: string, children: any[] = [], attributes: any[] = []) => ({
	type: "mdxJsxTextElement",
	name,
	attributes,
	children,
});
const strong = (children: any[] = []) => ({ type: "strong", children });

const expectedInline = (
	registryKey: string,
	name: string,
	range: Range,
	order = 0,
	attributes?: AnnotationAttr[],
): InlineAnnotation => {
	const config = registry.get(registryKey);
	if (!config || (config.type !== "inlineClass" && config.type !== "inlineWrap")) {
		throw new Error(`Unknown inline annotation config: ${registryKey}`);
	}

	if (config.type === "inlineClass") {
		return {
			...config,
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
			name,
			range,
			order,
			...(attributes ? { attributes } : {}),
		};
	}

	return {
		...config,
		type: "inlineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		name,
		range,
		order,
		...(attributes ? { attributes } : {}),
	};
};

describe("buildLineFromParagraph", () => {
	it("paragraph 텍스트를 Line.value로 합친다", () => {
		const line = buildLineFromParagraph(paragraph([text("hello"), text(" "), text("world")]), registry);

		expect(line).toEqual({ value: "hello world", annotations: [] });
	});

	it("mdast inline annotation은 InlineAnnotation으로 반환한다", () => {
		const line = buildLineFromParagraph(paragraph([text("x"), strong([text("ab")]), text("y")]), registry);

		expect(line).toEqual({
			value: "xaby",
			annotations: [expectedInline("strong", "strong", { start: 1, end: 3 })],
		});
	});

	it("mdx-text inline annotation은 named attribute를 값 타입 그대로 보존한다", () => {
		const line = buildLineFromParagraph(
			paragraph([
				text("a"),
				inline(
					"Tooltip",
					[text("bc")],
					[
						{ type: "mdxJsxAttribute", name: "title", value: "hint" },
						{ type: "mdxJsxAttribute", name: "enabled", value: true },
						{ type: "mdxJsxExpressionAttribute", value: "{x}" },
					],
				),
				text("d"),
			]),
			registry,
		);

		expect(line).toEqual({
			value: "abcd",
			annotations: [
				expectedInline("Tooltip", "Tooltip", { start: 1, end: 3 }, 0, [
					{ name: "title", value: "hint" },
					{ name: "enabled", value: true },
				]),
			],
		});
	});

	it("line 타입 registry 항목은 Line.annotations에 포함되지 않는다", () => {
		const line = buildLineFromParagraph(
			paragraph([inline("Collapsible", [text("x")]), inline("LineBadge", [text("y")])]),
			registry,
		);

		expect(line).toEqual({ value: "xy", annotations: [] });
	});

	it("알 수 없는 inline node는 annotation 없이 텍스트만 반영한다", () => {
		const line = buildLineFromParagraph(paragraph([inline("Unknown", [text("a")]), text("b")]), registry);

		expect(line).toEqual({ value: "ab", annotations: [] });
	});

	it("중첩된 inline annotation도 모두 InlineAnnotation 타입으로 반환한다", () => {
		const line = buildLineFromParagraph(
			paragraph([inline("u", [text("a"), strong([text("b")]), inline("Tooltip", [text("c")])]), text("d")]),
			registry,
		);

		expect(line.value).toBe("abcd");
		expect(line.annotations).toEqual(
			expect.arrayContaining([
				expectedInline("strong", "strong", { start: 1, end: 2 }, 0),
				expectedInline("Tooltip", "Tooltip", { start: 2, end: 3 }, 1, []),
				expectedInline("u", "u", { start: 0, end: 3 }, 2, []),
			]),
		);
		expect(
			line.annotations.every((annotation) => annotation.type === "inlineClass" || annotation.type === "inlineWrap"),
		).toBe(true);
	});

	it("빈 paragraph는 빈 Line을 반환한다", () => {
		const line = buildLineFromParagraph(paragraph([]), registry);

		expect(line).toEqual({ value: "", annotations: [] });
	});
});
