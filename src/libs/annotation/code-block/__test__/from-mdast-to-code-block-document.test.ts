import type { Paragraph, Text } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ as fromCodeBlockDocumentToMdastTestable } from "../document-to-mdast";
import { __testable__ } from "../mdast-to-document";
import type { AnnotationConfig, CodeBlockRoot, InlineAnnotation, LineAnnotation, Range } from "../types";

const { fromMdastToCodeBlockDocument } = __testable__;
const { toMdxAttrExpr } = fromCodeBlockDocumentToMdastTestable;

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

const text = (value: string): Text => ({ type: "text", value });
const paragraph = (children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children });
const inline = (
	name: string,
	children: MdxJsxTextElement["children"] = [],
	attributes: MdxJsxTextElement["attributes"] = [],
): MdxJsxTextElement => ({
	type: "mdxJsxTextElement",
	name,
	attributes,
	children,
});
const flow = (
	name: string,
	children: MdxJsxFlowElement["children"] = [],
	attributes: MdxJsxFlowElement["attributes"] = [],
): MdxJsxFlowElement => ({
	type: "mdxJsxFlowElement",
	name,
	attributes,
	children,
});
const codeBlock = (
	children: CodeBlockRoot["children"],
	attributes: CodeBlockRoot["attributes"] = [],
): CodeBlockRoot => ({
	type: "mdxJsxFlowElement",
	name: "CodeBlock",
	attributes,
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

describe("fromMdastToCodeBlockDocument", () => {
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

		const document = fromMdastToCodeBlockDocument(codeBlockNode, annotationConfig);

		expect(document).toEqual({
			lang: "text",
			meta: {},
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

		const document = fromMdastToCodeBlockDocument(codeBlockNode, annotationConfig);

		expect(document.lines).toEqual([
			{ value: "line1", annotations: [] },
			{ value: "", annotations: [] },
			{ value: "line3", annotations: [] },
		]);
	});

	it("라인 value에는 태그 문자열이 들어가지 않고 텍스트만 포함한다", () => {
		const node = codeBlock([paragraph([text("ab"), inline("u", [text("cd")]), text("ef")])]);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

		expect(document.annotations).toEqual([
			expectedLineWrap("Collapsible", { start: 0, end: 3 }, 0),
			expectedLineWrap("Collapsible", { start: 1, end: 2 }, 1),
		]);
		expect(document.lines).toEqual([
			{ value: "outer-1", annotations: [] },
			{ value: "inner-1", annotations: [] },
			{ value: "outer-2", annotations: [] },
		]);
	});

	it("lineWrap 내부의 중첩 lineWrap과 flow attributes를 재귀로 파싱한다", () => {
		const node = codeBlock([
			paragraph([text("첫 번째 줄")]),
			flow("Collapsible", [
				paragraph([text("두 번째 줄")]),
				flow(
					"Callout",
					[paragraph([text("callout 내부")])],
					[{ type: "mdxJsxAttribute", name: "variant", value: "tip" }],
				),
			]),
			paragraph([text("세번째 줄")]),
		]);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

		expect(document.annotations).toEqual([
			expectedLineWrap("Collapsible", { start: 1, end: 3 }, 0),
			{ ...expectedLineWrap("Callout", { start: 2, end: 3 }, 1), attributes: [{ name: "variant", value: "tip" }] },
		]);
		expect(document.lines).toEqual([
			{ value: "첫 번째 줄", annotations: [] },
			{ value: "두 번째 줄", annotations: [] },
			{ value: "callout 내부", annotations: [] },
			{ value: "세번째 줄", annotations: [] },
		]);
	});

	it("lineClass(diff)와 lineWrap(Callout)을 각각 line annotation으로 추출한다", () => {
		const node = codeBlock([
			paragraph([text("before")]),
			flow("diff", [paragraph([text("change-1")])]),
			flow("Callout", [paragraph([text("note-1")]), paragraph([text("note-2")])]),
			paragraph([text("after")]),
		]);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

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

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

		expect(document.annotations).toEqual([]);
		expect(document.lines).toEqual([{ value: "xyz", annotations: [] }]);
	});

	it("CodeBlock children이 비어있으면 빈 document를 반환한다", () => {
		const node = codeBlock([]);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

		expect(document).toEqual({
			lang: "text",
			meta: {},
			annotations: [],
			lines: [],
		});
	});

	it("lang/meta attribute를 document로 파싱한다", () => {
		const node = codeBlock(
			[paragraph([text("const x = 1")])],
			[
				{ type: "mdxJsxAttribute", name: "id", value: "091515e6-933a-4bd2-b4c0-9a7e05a17009" },
				{ type: "mdxJsxAttribute", name: "lang", value: "ts" },
				{
					type: "mdxJsxAttribute",
					name: "meta",
					value: toMdxAttrExpr({ filename: "demo.ts", showLineNumbers: true }),
				},
			],
		);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);

		expect(document.lang).toBe("ts");
		expect(document.meta).toEqual({ filename: "demo.ts", showLineNumbers: true });
	});

	it("inline/line annotation의 expression attribute를 document 값으로 파싱한다", () => {
		const node = codeBlock([
			paragraph([
				inline(
					"Tooltip",
					[text("hello")],
					[
						{ type: "mdxJsxAttribute", name: "content", value: "tip" },
						{ type: "mdxJsxAttribute", name: "open", value: toMdxAttrExpr(true) },
						{ type: "mdxJsxAttribute", name: "count", value: toMdxAttrExpr(2) },
						{ type: "mdxJsxAttribute", name: "meta", value: toMdxAttrExpr({ a: 1 }) },
						{ type: "mdxJsxAttribute", name: "items", value: toMdxAttrExpr([1, "x"]) },
						{ type: "mdxJsxAttribute", name: "collapsed", value: null },
					],
				),
			]),
			flow(
				"Callout",
				[paragraph([text("line")])],
				[
					{ type: "mdxJsxAttribute", name: "variant", value: "note" },
					{ type: "mdxJsxAttribute", name: "open", value: toMdxAttrExpr(true) },
					{ type: "mdxJsxAttribute", name: "count", value: toMdxAttrExpr(2) },
					{ type: "mdxJsxAttribute", name: "meta", value: toMdxAttrExpr({ a: 1 }) },
					{ type: "mdxJsxAttribute", name: "items", value: toMdxAttrExpr([1, "x"]) },
					{ type: "mdxJsxAttribute", name: "collapsed", value: null },
				],
			),
		]);

		const document = fromMdastToCodeBlockDocument(node, annotationConfig);
		const inlineAttrs = document.lines[0]?.annotations[0]?.attributes;
		const lineAttrs = document.annotations[0]?.attributes;

		expect(inlineAttrs).toEqual([
			{ name: "content", value: "tip" },
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
		expect(lineAttrs).toEqual([
			{ name: "variant", value: "note" },
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
	});
});
