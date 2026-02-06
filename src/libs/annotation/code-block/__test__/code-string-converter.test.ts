import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { buildCodeBlockDocumentFromCodeFence, composeCodeFenceFromCodeBlockDocument } from "../code-string-converter";
import type { AnnotationAttr, AnnotationConfig, CodeBlockDocument, InlineAnnotation, Line, LineAnnotation, Range } from "../types";

const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "u", source: "mdx-text", render: "u" },
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

const inWrapTag = ANNOTATION_TYPE_DEFINITION.inlineWrap.tag;
const lnClassTag = ANNOTATION_TYPE_DEFINITION.lineClass.tag;
const lnWrapTag = ANNOTATION_TYPE_DEFINITION.lineWrap.tag;

const inlineWrap = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): InlineAnnotation => {
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

const lineWrap = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): LineAnnotation => {
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
		attributes,
	};
};

const lineClass = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): LineAnnotation => {
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
		attributes,
	};
};

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

describe("code-string converter", () => {
	it("code fence를 document로 변환할 때 lang/meta와 tag 기반 annotation을 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="hello.ts" showLineNumbers',
			value: [
				`// @${lnWrapTag} Callout {0-2} tone="info"`,
				`// @${inWrapTag} Tooltip {0-7} content="tip"`,
				'console.log("hello")',
				`// @${lnClassTag} diff {1-2}`,
				"return 1",
			].join("\n"),
		};

		const document = buildCodeBlockDocumentFromCodeFence(input, annotationConfig);

		expect(document).toEqual({
			lang: "ts",
			meta: { title: "hello.ts", showLineNumbers: true },
			annotations: [
				lineWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }]),
				lineClass("diff", { start: 1, end: 2 }, 1),
			],
			lines: [
				line('console.log("hello")', [inlineWrap("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }])]),
				line("return 1"),
			],
		});
	});

	it("document를 code fence로 변환할 때 tag와 order 순서를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "hello.ts", showLineNumbers: true },
			annotations: [lineWrap("Callout", { start: 0, end: 2 }, 0), lineClass("diff", { start: 1, end: 2 }, 1)],
			lines: [
				line('console.log("hello")', [inlineWrap("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }])]),
				line("return 1"),
			],
		};

		const codeNode = composeCodeFenceFromCodeBlockDocument(input, annotationConfig);

		expect(codeNode.type).toBe("code");
		expect(codeNode.lang).toBe("ts");
		expect(codeNode.meta).toBe('title="hello.ts" showLineNumbers');
		expect(codeNode.value).toBe(
			[
				`// @${lnWrapTag} Callout {0-2}`,
				`// @${inWrapTag} Tooltip {0-7} content="tip"`,
				'console.log("hello")',
				`// @${lnClassTag} diff {1-2}`,
				"return 1",
			].join("\n"),
		);
	});

	it("동일 range wrapper의 order는 code string 라인 순서로 왕복 보존된다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @${lnWrapTag} Callout {0-1}`,
				`// @${lnWrapTag} Collapsible {0-1}`,
				`// @${inWrapTag} Tooltip {0-5}`,
				`// @${inWrapTag} u {0-5}`,
				"hello",
			].join("\n"),
		};

		const document = buildCodeBlockDocumentFromCodeFence(input, annotationConfig);
		const output = composeCodeFenceFromCodeBlockDocument(document, annotationConfig);

		expect(document.annotations.map((annotation) => annotation.name)).toEqual(["Callout", "Collapsible"]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.name)).toEqual(["Tooltip", "u"]);
		expect(output.value).toBe(input.value);
	});

	it("document -> code -> document 라운드트립에서 lang/meta/annotations를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "roundtrip.ts", showLineNumbers: true, fold: false },
			annotations: [
				lineWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }]),
				lineClass("diff", { start: 1, end: 2 }, 1),
			],
			lines: [
				line('const value = "hello"', [
					inlineWrap("Tooltip", { start: 6, end: 11 }, 0, [{ name: "content", value: "tip" }]),
					inlineWrap("u", { start: 14, end: 21 }, 1),
				]),
				line("return value"),
			],
		};

		const code = composeCodeFenceFromCodeBlockDocument(input, annotationConfig);
		const output = buildCodeBlockDocumentFromCodeFence(code, annotationConfig);

		expect(output).toEqual(input);
	});

	it("code -> document -> code 라운드트립에서 canonical code fence를 보존한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="canon.ts" showLineNumbers fold=false',
			value: [
				`// @${lnWrapTag} Callout {0-2} tone="warn"`,
				`// @${inWrapTag} Tooltip {6-11} content="tip"`,
				'const value = "hello"',
				`// @${lnClassTag} diff {1-2}`,
				"return value",
			].join("\n"),
		};

		const document = buildCodeBlockDocumentFromCodeFence(input, annotationConfig);
		const output = composeCodeFenceFromCodeBlockDocument(document, annotationConfig);

		expect(output).toEqual(input);
	});
});
