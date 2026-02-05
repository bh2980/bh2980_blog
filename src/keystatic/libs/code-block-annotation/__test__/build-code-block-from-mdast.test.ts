import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../keystatic-annotation-manager";
import type { AnnotationConfig, CodeBlockRoot, InlineAnnotation, LineAnnotation, Range } from "../types";

const { buildCodeBlockDocumentFromMdast } = __testable__;

const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "strong", source: "mdast", render: "strong" },
		{ name: "emphasis", source: "mdast", render: "em" },
		{ name: "delete", source: "mdast", render: "del" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	lineWrap: [
		{ name: "Collapsible", source: "mdast", render: "collapsible" },
		{ name: "Callout", source: "mdx-flow", render: "Callout" },
	],
};

const text = (value: string) => ({ type: "text", value });
const paragraph = (children: any[]) => ({ type: "paragraph", children });
const inline = (name: string, children: any[] = []) => ({
	type: "mdxJsxTextElement",
	name,
	attributes: [],
	children,
});
const flow = (name: string, children: any[] = []) => ({
	type: "mdxJsxFlowElement",
	name,
	attributes: [],
	children,
});
const codeBlock = (children: any[]): CodeBlockRoot => ({
	type: "mdxJsxFlowElement",
	name: "CodeBlock",
	attributes: [],
	children,
});

const inlineWrapByName = new Map(
	(annotationConfig.inlineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineClassByName = new Map(
	(annotationConfig.lineClass ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineWrapByName = new Map(
	(annotationConfig.lineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);

const expectedInlineWrap = (name: string, range: Range, order = 0): InlineAnnotation => {
	const config = inlineWrapByName.get(name);
	if (!config) throw new Error(`Unknown inlineWrap config: ${name}`);

	return {
		...config,
		type: "inlineWrap" as const,
		typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		name,
		range,
		order,
		attributes: [],
	};
};

const expectedLineWrap = (name: string, range: Range, order = 0): LineAnnotation => {
	const config = lineWrapByName.get(name);
	if (!config) throw new Error(`Unknown lineWrap config: ${name}`);

	return {
		...config,
		type: "lineWrap" as const,
		typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
		name,
		range,
		order,
	};
};

const expectedLineClass = (name: string, range: Range, order = 0): LineAnnotation => {
	const config = lineClassByName.get(name);
	if (!config) throw new Error(`Unknown lineClass config: ${name}`);

	return {
		...config,
		type: "lineClass" as const,
		typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineClass.tag,
		name,
		range,
		order,
	};
};

describe("buildCodeBlockDocumentFromMdast", () => {
	it("기본: lineWrap annotation + line inlineWrap annotation을 문서로 변환한다", () => {
		const codeBlockNode = codeBlock([
			{
				type: "paragraph",
				children: [
					{
						type: "mdxJsxTextElement",
						name: "u",
						attributes: [],
						children: [{ type: "text", value: "l" }],
					},
					{ type: "text", value: "ine1" },
				],
			},
			{
				type: "mdxJsxFlowElement",
				name: "Collapsible",
				attributes: [],
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "line2" }],
					},
				],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "line3" }],
			},
		]);

		const document = buildCodeBlockDocumentFromMdast(codeBlockNode, annotationConfig);

		expect(document).toEqual({
			annotations: [expectedLineWrap("Collapsible", { start: 1, end: 2 })],
			lines: [
				{
					value: "line1",
					annotations: [expectedInlineWrap("u", { start: 0, end: 1 })],
				},
				{ value: "line2", annotations: [] },
				{ value: "line3", annotations: [] },
			],
		});
	});

	it("빈 paragraph(children: [])는 빈 라인으로 포함한다", () => {
		const codeBlockNode = codeBlock([
			{
				type: "paragraph",
				children: [{ type: "text", value: "line1" }],
			},
			{
				type: "paragraph",
				children: [],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "line3" }],
			},
		]);

		const document = buildCodeBlockDocumentFromMdast(codeBlockNode, annotationConfig);

		expect(document.lines).toEqual([
			{ value: "line1", annotations: [] },
			{ value: "", annotations: [] },
			{ value: "line3", annotations: [] },
		]);
	});

	it("라인 value에는 태그 문자열이 들어가지 않고 텍스트만 포함한다", () => {
		const node = codeBlock([paragraph([text("ab"), inline("u", [text("cd")]), text("ef")])]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "abcdef",
				annotations: [expectedInlineWrap("u", { start: 2, end: 4 })],
			},
		]);
		expect(document.lines[0]?.value).not.toContain("<u>");
		expect(document.lines[0]?.value).not.toContain("</u>");
	});

	it("동일 라인에 여러 inlineWrap이 있으면 각 range를 독립적으로 계산한다", () => {
		const node = codeBlock([
			paragraph([inline("u", [text("ab")]), text("cd"), inline("Tooltip", [text("efg")]), text("h")]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "abcdefgh",
				annotations: [
					expectedInlineWrap("u", { start: 0, end: 2 }, 0),
					expectedInlineWrap("Tooltip", { start: 4, end: 7 }, 1),
				],
			},
		]);
	});

	it("inlineWrap range의 end는 exclusive다", () => {
		const node = codeBlock([paragraph([inline("u", [text("abc")])])]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "abc",
				annotations: [expectedInlineWrap("u", { start: 0, end: 3 })],
			},
		]);
	});

	it("라인 annotation range는 절대 오프셋이 아니라 라인 오프셋 기준이다", () => {
		const node = codeBlock([
			paragraph([inline("u", [text("a")]), text("1")]),
			paragraph([inline("u", [text("b")]), text("2")]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "a1",
				annotations: [expectedInlineWrap("u", { start: 0, end: 1 })],
			},
			{
				value: "b2",
				annotations: [expectedInlineWrap("u", { start: 0, end: 1 })],
			},
		]);
	});

	it("중첩 inlineWrap은 같은 라인에서 각자 range를 유지한다", () => {
		const node = codeBlock([paragraph([inline("u", [text("a"), inline("Tooltip", [text("b")])])])]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "ab",
				annotations: [
					expectedInlineWrap("Tooltip", { start: 1, end: 2 }, 0),
					expectedInlineWrap("u", { start: 0, end: 2 }, 1),
				],
			},
		]);
	});

	it("lineWrap range는 라인 인덱스 기준 [start, end)로 계산한다", () => {
		const node = codeBlock([
			paragraph([text("before")]),
			flow("Collapsible", [paragraph([text("inside-1")]), paragraph([]), paragraph([text("inside-3")])]),
			paragraph([text("after")]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.annotations).toEqual([expectedLineWrap("Collapsible", { start: 1, end: 4 })]);
		expect(document.lines).toEqual([
			{ value: "before", annotations: [] },
			{ value: "inside-1", annotations: [] },
			{ value: "", annotations: [] },
			{ value: "inside-3", annotations: [] },
			{ value: "after", annotations: [] },
		]);
	});

	it("중첩 lineWrap이 있으면 각각의 라인 범위를 유지한다", () => {
		const node = codeBlock([
			flow("Collapsible", [
				paragraph([text("outer-1")]),
				flow("Collapsible", [paragraph([text("inner-1")])]),
				paragraph([text("outer-2")]),
			]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.annotations).toEqual([expectedLineWrap("Collapsible", { start: 0, end: 2 })]);
		expect(document.lines).toEqual([
			{ value: "outer-1", annotations: [] },
			{ value: "outer-2", annotations: [] },
		]);
	});

	it("lineClass(diff)와 lineWrap(Callout)을 각각 line annotation으로 추출한다", () => {
		const node = codeBlock([
			paragraph([text("before")]),
			flow("diff", [paragraph([text("change-1")])]),
			flow("Callout", [paragraph([text("note-1")]), paragraph([text("note-2")])]),
			paragraph([text("after")]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.annotations).toEqual([
			expectedLineClass("diff", { start: 1, end: 2 }, 0),
			expectedLineWrap("Callout", { start: 2, end: 4 }, 1),
		]);
		expect(document.lines).toEqual([
			{ value: "before", annotations: [] },
			{ value: "change-1", annotations: [] },
			{ value: "note-1", annotations: [] },
			{ value: "note-2", annotations: [] },
			{ value: "after", annotations: [] },
		]);
	});

	it("알 수 없는 inline/flow name은 annotation으로 분류하지 않고 텍스트만 반영한다", () => {
		const node = codeBlock([
			paragraph([inline("UnknownInline", [text("x")]), text("yz")]),
			flow("UnknownFlow", [paragraph([text("line2")])]),
		]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document.annotations).toEqual([]);
		expect(document.lines).toEqual([{ value: "xyz", annotations: [] }]);
	});

	it("CodeBlock children이 비어있으면 빈 document를 반환한다", () => {
		const node = codeBlock([]);

		const document = buildCodeBlockDocumentFromMdast(node, annotationConfig);

		expect(document).toEqual({
			annotations: [],
			lines: [],
		});
	});
});
