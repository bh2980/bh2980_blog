import type { Paragraph, Text } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeBlockDocumentToMdastTestable } from "../document-to-mdast";
import { __testable__ } from "../mdast-to-document";
import type { AnnotationConfig, AnnotationConfigItem, CodeBlockRoot, InlineAnnotation, Range } from "../types";

const { fromMdxFlowElementToCodeDocument } = __testable__;
const { toMdxAttrExpr } = fromCodeBlockDocumentToMdastTestable;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "strong", kind: "render", source: "mdast", render: "strong", scopes: ["char"] },
		{ name: "emphasis", kind: "render", source: "mdast", render: "em", scopes: ["char"] },
		{ name: "delete", kind: "render", source: "mdast", render: "del", scopes: ["char"] },
		{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char"] },
		{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
		{ name: "Collapsible", kind: "render", render: "collapsible", scopes: ["line"] },
		{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
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

const charRenderByName = new Map(
	(annotationConfig.annotations ?? [])
		.filter(
			(item): item is Extract<AnnotationConfigItem, { kind: "render" }> =>
				item.kind === "render" && (item.scopes ?? []).includes("char"),
		)
		.map((item, priority) => [item.name, { ...item, priority }]),
);

const expectedCharRender = (name: string, range: Range, order = 0): InlineAnnotation => {
	const config = charRenderByName.get(name);
	if (!config) throw new Error(`Unknown charRender config: ${name}`);

	return {
		scope: "char" as const,
		source: config.source ?? "mdx-text",
		render: config.render,
		priority: config.priority,
		name,
		range,
		order,
		attributes: [],
	};
};

describe("fromMdxFlowElementToCodeDocument", () => {
	it("paragraph만 라인으로 파싱하고 flow wrapper는 무시한다", () => {
		const codeBlockNode = codeBlock([
			paragraph([inline("u", [text("l")]), text("ine1")]),
			flow("Collapsible", [paragraph([text("line2")])]),
			paragraph([text("line3")]),
		]);

		const document = fromMdxFlowElementToCodeDocument(codeBlockNode, annotationConfig);

		expect(document).toEqual({
			lang: "text",
			meta: {},
			annotations: [],
			lines: [
				{
					value: "line1",
					annotations: [expectedCharRender("u", { start: 0, end: 1 })],
				},
				{ value: "line3", annotations: [] },
			],
		});
	});

	it("빈 paragraph(children: [])는 빈 라인으로 포함한다", () => {
		const codeBlockNode = codeBlock([
			paragraph([text("line1")]),
			paragraph([]),
			paragraph([text("line3")]),
		]);

		const document = fromMdxFlowElementToCodeDocument(codeBlockNode, annotationConfig);

		expect(document.lines).toEqual([
			{ value: "line1", annotations: [] },
			{ value: "", annotations: [] },
			{ value: "line3", annotations: [] },
		]);
	});

	it("inline annotation range는 코드 블록 절대 오프셋 기준이다", () => {
		const node = codeBlock([
			paragraph([inline("u", [text("a")]), text("1")]),
			paragraph([inline("u", [text("b")]), text("2")]),
		]);

		const document = fromMdxFlowElementToCodeDocument(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "a1",
				annotations: [expectedCharRender("u", { start: 0, end: 1 })],
			},
			{
				value: "b2",
				annotations: [expectedCharRender("u", { start: 3, end: 4 })],
			},
		]);
	});

	it("inline wrapper 내부 break는 줄 분리 후에도 absolute range를 유지한다", () => {
		const node = codeBlock([
			paragraph([
				inline("u", [
					text("ab"),
					{ type: "break" },
					text("cd"),
				]),
				text("!"),
			]),
		]);

		const document = fromMdxFlowElementToCodeDocument(node, annotationConfig);

		expect(document.lines).toEqual([
			{
				value: "ab",
				annotations: [expectedCharRender("u", { start: 0, end: 2 })],
			},
			{
				value: "cd!",
				annotations: [expectedCharRender("u", { start: 3, end: 5 })],
			},
		]);
	});

	it("알 수 없는 inline/flow name은 annotation으로 분류하지 않고 텍스트만 반영한다", () => {
		const node = codeBlock([
			paragraph([inline("UnknownInline", [text("x")]), text("yz")]),
			flow("UnknownFlow", [paragraph([text("line2")])]),
		]);

		const document = fromMdxFlowElementToCodeDocument(node, annotationConfig);

		expect(document.annotations).toEqual([]);
		expect(document.lines).toEqual([{ value: "xyz", annotations: [] }]);
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

		const document = fromMdxFlowElementToCodeDocument(node, annotationConfig);

		expect(document.lang).toBe("ts");
		expect(document.meta).toEqual({ filename: "demo.ts", showLineNumbers: true });
	});

	it("inline annotation의 expression attribute를 document 값으로 파싱한다", () => {
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
				],
			),
		]);

		const document = fromMdxFlowElementToCodeDocument(node, annotationConfig);
		const inlineAttrs = document.lines[0]?.annotations[0]?.attributes;

		expect(inlineAttrs).toEqual([
			{ name: "content", value: "tip" },
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: true },
		]);
		expect(document.annotations).toEqual([]);
	});
});
