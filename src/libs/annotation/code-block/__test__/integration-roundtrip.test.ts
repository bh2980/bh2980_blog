import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { buildCodeBlockDocumentFromCodeFence, composeCodeFenceFromCodeBlockDocument } from "../code-string-converter";
import { createMdxJsxAttributeValueExpression } from "../libs";
import { __testable__ } from "../mdast-document-converter";
import type { AnnotationConfig, CodeBlockDocument, CodeBlockRoot, InlineAnnotation, LineAnnotation, Range } from "../types";

const { buildCodeBlockDocumentFromMdast, composeCodeBlockRootFromDocument } = __testable__;

const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "u", source: "mdx-text", render: "u" },
		{ name: "strong", source: "mdast", render: "strong" },
	],
	lineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	lineWrap: [
		{ name: "Callout", source: "mdx-flow", render: "Callout" },
		{ name: "Collapsible", source: "mdx-flow", render: "Collapsible" },
	],
};

const inlineWrapByName = new Map(
	(annotationConfig.inlineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineClassByName = new Map(
	(annotationConfig.lineClass ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineWrapByName = new Map(
	(annotationConfig.lineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);

const inlineWrap = (name: string, range: Range, order: number, attributes: { name: string; value: string }[] = []): InlineAnnotation => {
	const config = inlineWrapByName.get(name);
	if (!config) throw new Error(`Unknown inlineWrap config: ${name}`);

	return {
		...config,
		type: "inlineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		name,
		range,
		order,
		attributes,
	};
};

const lineClass = (name: string, range: Range, order: number): LineAnnotation => {
	const config = lineClassByName.get(name);
	if (!config) throw new Error(`Unknown lineClass config: ${name}`);

	return {
		...config,
		type: "lineClass",
		typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineClass.tag,
		name,
		range,
		order,
	};
};

const lineWrap = (name: string, range: Range, order: number): LineAnnotation => {
	const config = lineWrapByName.get(name);
	if (!config) throw new Error(`Unknown lineWrap config: ${name}`);

	return {
		...config,
		type: "lineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
		name,
		range,
		order,
	};
};

describe("integration roundtrip (pure functions)", () => {
	it("document -> code -> document -> mdast -> document 파이프라인에서 document를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "integration.ts", showLineNumbers: true },
			lines: [
				{
					value: "const alpha = 1",
					annotations: [inlineWrap("Tooltip", { start: 6, end: 11 }, 0, [{ name: "content", value: "alpha" }])],
				},
				{
					value: "const beta = alpha + 1",
					annotations: [inlineWrap("u", { start: 6, end: 10 }, 0)],
				},
				{
					value: "return beta",
					annotations: [inlineWrap("u", { start: 7, end: 11 }, 0)],
				},
			],
			annotations: [lineWrap("Callout", { start: 0, end: 2 }, 0), lineClass("diff", { start: 2, end: 3 }, 1)],
		};

		const code = composeCodeFenceFromCodeBlockDocument(input, annotationConfig);
		const documentFromCode = buildCodeBlockDocumentFromCodeFence(code, annotationConfig);
		const mdast = composeCodeBlockRootFromDocument(documentFromCode, annotationConfig);
		const output = buildCodeBlockDocumentFromMdast(mdast, annotationConfig);

		expect(output).toEqual(input);
	});

	it("mdast -> document -> code -> document -> mdast 파이프라인에서 document를 보존한다", () => {
		const mdastInput: CodeBlockRoot = {
			type: "mdxJsxFlowElement",
			name: "CodeBlock",
			attributes: [
				{ type: "mdxJsxAttribute", name: "lang", value: "ts" },
				{
					type: "mdxJsxAttribute",
					name: "meta",
					value: createMdxJsxAttributeValueExpression({ title: "pipe.ts", showLineNumbers: true }),
				},
			],
			children: [
				{
					type: "mdxJsxFlowElement",
					name: "Callout",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [
								{ type: "text", value: "const " },
								{
									type: "mdxJsxTextElement",
									name: "Tooltip",
									attributes: [{ type: "mdxJsxAttribute", name: "content", value: "name" }],
									children: [{ type: "text", value: "name" }],
								},
								{ type: "text", value: " = 1" },
							],
						},
						{
							type: "paragraph",
							children: [{ type: "text", value: "return name" }],
						},
					],
				},
				{
					type: "mdxJsxFlowElement",
					name: "diff",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "after" }],
						},
					],
				},
			],
		};

		const document1 = buildCodeBlockDocumentFromMdast(mdastInput, annotationConfig);
		const code = composeCodeFenceFromCodeBlockDocument(document1, annotationConfig);
		const document2 = buildCodeBlockDocumentFromCodeFence(code, annotationConfig);
		const mdastOutput = composeCodeBlockRootFromDocument(document2, annotationConfig);
		const document3 = buildCodeBlockDocumentFromMdast(mdastOutput, annotationConfig);

		expect(document3).toEqual(document1);
	});
});
