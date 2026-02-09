import type { AnnotationAttr } from "../types";
import type { CodeBlockDocument, AnnotationConfig, CodeBlockRoot } from "../types";
import { describe, expect, it } from "vitest";
import { __testable__ as documentToMdast } from "../document-to-mdast";
import { __testable__ as mdastToDocument } from "../mdast-to-document";

const { fromCodeBlockDocumentToMdast } = documentToMdast;
const { fromMdxFlowElementToCodeDocument } = mdastToDocument;

const annotationConfig: AnnotationConfig = {
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [{ name: "diff", class: "diff" }],
	lineWrap: [{ name: "Collapsible", render: "Collapsible" }],
};

const inlineWrap = (
	name: string,
	range: { start: number; end: number },
	order: number,
	attributes: AnnotationAttr[] = [],
) => ({
	type: "inlineWrap" as const,
	typeId: 1,
	tag: "inWrap",
	source: "mdx-text" as const,
	render: name,
	name,
	range,
	priority: name === "u" ? 1 : 0,
	order,
	attributes,
});

const lineWrap = (name: string, range: { start: number; end: number }, order: number) => ({
	type: "lineWrap" as const,
	typeId: 3,
	tag: "lnWrap",
	render: name,
	name,
	range,
	priority: 0,
	order,
});

const toDocument = (lines: CodeBlockDocument["lines"], annotations: CodeBlockDocument["annotations"] = []): CodeBlockDocument => ({
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
		const ast = fromCodeBlockDocumentToMdast(toDocument([{ value: "line-1", annotations: [] }, { value: "line-2", annotations: [] }]), annotationConfig);
		const paragraph = getSingleParagraph(ast);

		expect(paragraph.children).toEqual([
			{ type: "text", value: "line-1" },
			{ type: "break" },
			{ type: "text", value: "line-2" },
		]);
	});

	it("line annotation은 flow wrapper를 만들지 않는다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([{ value: "const a = 1", annotations: [] }], [lineWrap("Collapsible", { start: 0, end: 1 }, 0)]),
			annotationConfig,
		);

		expect(ast.children).toHaveLength(1);
		expect(ast.children.some((node) => node.type === "mdxJsxFlowElement")).toBe(false);
	});

	it("inline annotation attribute를 mdx attribute 값으로 보존한다", () => {
		const ast = fromCodeBlockDocumentToMdast(
			toDocument([
				{
					value: "hello",
					annotations: [
						inlineWrap("Tooltip", { start: 0, end: 5 }, 0, [
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
				annotations: [inlineWrap("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])],
			},
			{
				value: "world",
				annotations: [inlineWrap("u", { start: 6, end: 11 }, 0)],
			},
		]);

		const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);
		const output = fromMdxFlowElementToCodeDocument(ast, annotationConfig);

		expect(output.lang).toBe(input.lang);
		expect(output.meta).toEqual(input.meta);
		expect(output.annotations).toEqual([]);
		expect(output.lines).toEqual(input.lines);
	});
});
