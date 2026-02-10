import { describe, expect, it } from "vitest";
import { __testable__ as documentToMdast } from "../document-to-mdast";
import { __testable__ as mdastToDocument } from "../mdast-to-document";
import type { AnnotationAttr, AnnotationConfig, CodeBlockDocument, CodeBlockRoot } from "../types";

const { fromCodeBlockDocumentToMdast } = documentToMdast;
const { fromMdxFlowElementToCodeDocument } = mdastToDocument;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char"] },
		{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
		{ name: "Collapsible", kind: "render", render: "Collapsible", scopes: ["line"] },
	],
};

const charRender = (
	name: string,
	range: { start: number; end: number },
	order: number,
	attributes: AnnotationAttr[] = [],
) => ({
	scope: "char" as const,
	source: "mdx-text" as const,
	render: name,
	name,
	range,
	priority: name === "u" ? 1 : 0,
	order,
	attributes,
});

const rowWrap = (name: string, range: { start: number; end: number }, order: number) => ({
	scope: "line" as const,
	render: name,
	name,
	range,
	priority: 0,
	order,
});

const toDocument = (
	lines: CodeBlockDocument["lines"],
	annotations: CodeBlockDocument["annotations"] = [],
): CodeBlockDocument => ({
	lang: "ts",
	meta: { title: "demo.ts", showLineNumbers: true },
	lines,
	annotations,
});

const getSingleParagraph = (ast: CodeBlockRoot) => {
	expect(ast.children).toHaveLength(1);
	const paragraph = ast.children[0];
	expect(paragraph?.type).toBe("paragraph");
	if (!paragraph || paragraph.type !== "paragraph") {
		throw new Error("paragraph not found");
	}
	return paragraph;
};

describe("fromCodeBlockDocumentToMdast", () => {
	it("annotationConfig 없이 호출하면 에러를 던진다", () => {
		const input = toDocument([]);
		expect(() => fromCodeBlockDocumentToMdast(input, undefined as never)).toThrowError(
			"[createAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("line들을 단일 paragraph + hard break로 변환한다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([
				{ value: "line-1", annotations: [] },
				{ value: "line-2", annotations: [] },
			]),
			annotationConfig,
		);
		const paragraph = getSingleParagraph(ast);

		expect(paragraph.children).toEqual([
			{ type: "text", value: "line-1" },
			{ type: "break" },
			{ type: "text", value: "line-2" },
		]);
	});

	it("line annotation은 flow wrapper를 만들지 않는다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([{ value: "const a = 1", annotations: [] }], [rowWrap("Collapsible", { start: 0, end: 1 }, 0)]),
			annotationConfig,
		);

		expect(ast.children).toHaveLength(1);
		expect(ast.children.some((node) => node.type === "mdxJsxFlowElement")).toBe(false);
	});

	it("scope=document inline annotation은 mdast 변환에서 제외한다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([
				{
					value: "hello",
					annotations: [
						{
							scope: "document",
							source: "mdx-text",
							render: "Tooltip",
							name: "Tooltip",
							range: { start: 0, end: 5 },
							priority: 0,
							order: 0,
							attributes: [],
						},
					],
				},
			]),
			annotationConfig,
		);
		const paragraph = getSingleParagraph(ast);

		expect(paragraph.children).toEqual([{ type: "text", value: "hello" }]);
	});

	it("inline annotation attribute를 mdx attribute 값으로 보존한다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([
				{
					value: "hello",
					annotations: [
						charRender("Tooltip", { start: 0, end: 5 }, 0, [
							{ name: "content", value: "tip" },
							{ name: "open", value: true },
							{ name: "count", value: 2 },
						]),
					],
				},
			]),
			annotationConfig,
		);
		const paragraph = getSingleParagraph(ast);
		const tooltip = paragraph.children[0];
		expect(tooltip?.type).toBe("mdxJsxTextElement");
		if (!tooltip || tooltip.type !== "mdxJsxTextElement") {
			throw new Error("Tooltip node not found");
		}

		const attrs = tooltip.attributes
			.filter((attr) => attr.type === "mdxJsxAttribute")
			.map((attr) => ({ name: attr.name, value: attr.value }));

		expect(attrs).toEqual(
			expect.arrayContaining([
				{ name: "content", value: "tip" },
				{ name: "open", value: expect.objectContaining({ type: "mdxJsxAttributeValueExpression", value: "true" }) },
				{ name: "count", value: expect.objectContaining({ type: "mdxJsxAttributeValueExpression", value: "2" }) },
			]),
		);
	});

	it("document -> mdast -> document 라운드트립에서 inline 절대 offset을 보존한다", () => {
		const input = toDocument([
			{
				value: "hello",
				annotations: [charRender("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])],
			},
			{
				value: "world",
				annotations: [charRender("u", { start: 6, end: 11 }, 0)],
			},
		]);

		const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);
		const output = fromMdxFlowElementToCodeDocument(ast, annotationConfig);

		expect(output.lang).toBe(input.lang);
		expect(output.meta).toEqual(input.meta);
		expect(output.annotations).toEqual([]);
		expect(output.lines).toEqual(input.lines);
	});

	it("inline 절대 offset이 라인 길이 조건을 우연히 만족해도 로컬 변환은 항상 lineOffset 기준으로 계산한다", () => {
		const input = toDocument([
			{
				value: "ab",
				annotations: [],
			},
			{
				value: "0123456789abcdefghijklmnopqrstuvwxyz",
				annotations: [charRender("Tooltip", { start: 8, end: 12 }, 0)],
			},
		]);

		const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);
		const output = fromMdxFlowElementToCodeDocument(ast, annotationConfig);

		expect(output.lines).toEqual(input.lines);
	});

	it("document -> mdast -> document 라운드트립에서 line annotation은 제거되고 inline만 유지된다", () => {
		const input = toDocument(
			[
				{
					value: "hello",
					annotations: [charRender("Tooltip", { start: 0, end: 5 }, 0)],
				},
				{
					value: "world",
					annotations: [],
				},
			],
			[rowWrap("Collapsible", { start: 0, end: 2 }, 0)],
		);

		const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);
		const output = fromMdxFlowElementToCodeDocument(ast, annotationConfig);

		expect(output.annotations).toEqual([]);
		expect(output.lines).toEqual(input.lines);
	});
});
