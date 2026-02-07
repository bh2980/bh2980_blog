import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ as fromCodeBlockDocumentToCodeFenceTestable } from "../document-to-code-fence";
import type {
	AnnotationAttr,
	AnnotationConfig,
	CodeBlockDocument,
	InlineAnnotation,
	Line,
	LineAnnotation,
	Range,
} from "../types";

const { fromCodeFenceToCodeBlockDocument } = fromCodeFenceToCodeBlockDocumentTestable;
const { fromCodeBlockDocumentToCodeFence } = fromCodeBlockDocumentToCodeFenceTestable;

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

const customTagConfig: AnnotationConfig = {
	...annotationConfig,
	tagOverrides: {
		inlineWrap: "iw",
		lineClass: "lc",
		lineWrap: "lw",
	},
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

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document).toEqual({
			lang: "ts",
			meta: { title: "hello.ts", showLineNumbers: true },
			annotations: [
				lineWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }]),
				lineClass("diff", { start: 1, end: 2 }, 1),
			],
			lines: [
				line('console.log("hello")', [
					inlineWrap("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }]),
				]),
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
				line('console.log("hello")', [
					inlineWrap("Tooltip", { start: 0, end: 7 }, 0, [{ name: "content", value: "tip" }]),
				]),
				line("return 1"),
			],
		};

		const codeNode = fromCodeBlockDocumentToCodeFence(input, annotationConfig);

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

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, annotationConfig);

		expect(document.annotations.map((annotation) => annotation.name)).toEqual(["Callout", "Collapsible"]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.name)).toEqual(["Tooltip", "u"]);
		expect(output.value).toBe(input.value);
	});

	it("document -> code -> document 라운드트립에서 lang/meta/annotations를 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "roundtrip.ts", showLineNumbers: true },
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

		const code = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const output = fromCodeFenceToCodeBlockDocument(code, annotationConfig);

		expect(output).toEqual(input);
	});

	it("code -> document -> code 라운드트립에서 canonical code fence를 보존한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="canon.ts" showLineNumbers',
			value: [
				`// @${lnWrapTag} Callout {0-2} tone="warn"`,
				`// @${inWrapTag} Tooltip {6-11} content="tip"`,
				'const value = "hello"',
				`// @${lnClassTag} diff {1-2}`,
				"return value",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, annotationConfig);

		expect(output).toEqual(input);
	});

	it("meta boolean이 false인 값은 직렬화 시 제외한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "meta.ts", showLineNumbers: false, collapsed: true },
			annotations: [],
			lines: [line("console.log('x')")],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const parsed = fromCodeFenceToCodeBlockDocument(output, annotationConfig);

		expect(output.meta).toBe('title="meta.ts" collapsed');
		expect(parsed.meta).toEqual({ title: "meta.ts", collapsed: true });
		expect(parsed.meta).not.toHaveProperty("showLineNumbers");
	});

	it("document -> code에서 annotation attribute를 JSON 표현으로 직렬화한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [
				lineWrap("Callout", { start: 0, end: 1 }, 0, [
					{ name: "open", value: true },
					{ name: "count", value: 2 },
					{ name: "meta", value: { a: 1 } },
					{ name: "items", value: [1, "x"] },
					{ name: "collapsed", value: null },
				]),
			],
			lines: [line("hello")],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const first = output.value.split("\n")[0];

		expect(first).toContain("open");
		expect(first).not.toContain("open=true");
		expect(first).toContain("count=2");
		expect(first).toContain('meta={"a":1}');
		expect(first).toContain('items=[1,"x"]');
		expect(first).toContain("collapsed=null");
	});

	it("document -> code에서 boolean attribute는 true면 key만, false면 생략한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			annotations: [
				lineWrap("Callout", { start: 0, end: 1 }, 0, [
					{ name: "showLineNumbers", value: true },
					{ name: "collapsed", value: false },
					{ name: "count", value: 2 },
				]),
			],
			lines: [
				line("hello", [
					inlineWrap("Tooltip", { start: 0, end: 5 }, 0, [
						{ name: "showLineNumbers", value: true },
						{ name: "collapsed", value: false },
					]),
				]),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const lines = output.value.split("\n");
		const lineWrapComment = lines[0] ?? "";
		const inlineComment = lines[1] ?? "";

		expect(lineWrapComment).toContain("showLineNumbers");
		expect(lineWrapComment).not.toContain("showLineNumbers=true");
		expect(lineWrapComment).not.toContain("collapsed");
		expect(lineWrapComment).toContain("count=2");

		expect(inlineComment).toContain("showLineNumbers");
		expect(inlineComment).not.toContain("showLineNumbers=true");
		expect(inlineComment).not.toContain("collapsed");
	});

	it("code -> document에서 annotation attribute의 JSON 타입을 복원한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @${lnWrapTag} Callout {0-1} open=true count=2 meta={"a":1} items=[1,"x"] collapsed=null`,
				`// @${inWrapTag} Tooltip {0-5} open=true count=2 meta={"a":1} items=[1,"x"] collapsed=null`,
				"hello",
			].join("\n"),
		};

		const output = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const lineWrapAttrs = output.annotations[0]?.attributes;
		const inlineAttrs = output.lines[0]?.annotations[0]?.attributes;

		expect(lineWrapAttrs).toEqual([
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
		expect(inlineAttrs).toEqual([
			{ name: "open", value: true },
			{ name: "count", value: 2 },
			{ name: "meta", value: { a: 1 } },
			{ name: "items", value: [1, "x"] },
			{ name: "collapsed", value: null },
		]);
	});

	it("code -> document에서 boolean shorthand attribute를 true로 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				`// @${lnWrapTag} Callout {0-1} showLineNumbers`,
				`// @${inWrapTag} Tooltip {0-5} showLineNumbers`,
				"hello",
			].join("\n"),
		};

		const output = fromCodeFenceToCodeBlockDocument(input, annotationConfig);
		const lineWrapAttrs = output.annotations[0]?.attributes;
		const inlineAttrs = output.lines[0]?.annotations[0]?.attributes;

		expect(lineWrapAttrs).toEqual([{ name: "showLineNumbers", value: true }]);
		expect(inlineAttrs).toEqual([{ name: "showLineNumbers", value: true }]);
	});

	it("tagOverrides를 설정하면 custom tag로 파싱/직렬화한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: 'title="custom.ts"',
			value: [`// @lw Callout {0-1}`, `// @iw Tooltip {0-5} content="tip"`, "hello", `// @lc diff {1-2}`, "world"].join(
				"\n",
			),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, customTagConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, customTagConfig);

		expect(document.annotations[0]?.tag).toBe("lw");
		expect(document.annotations[1]?.tag).toBe("lc");
		expect(document.lines[0]?.annotations[0]?.tag).toBe("iw");
		expect(output.value).toContain("// @lw Callout {0-1}");
		expect(output.value).toContain('// @iw Tooltip {0-5} content="tip"');
		expect(output.value).toContain("// @lc diff {1-2}");
	});

	it("tagOverrides가 있어도 기본 tag 입력을 호환 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [`// @${lnWrapTag} Callout {0-1}`, `// @${inWrapTag} Tooltip {0-5}`, "hello"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, customTagConfig);
		const output = fromCodeBlockDocumentToCodeFence(document, customTagConfig);

		expect(document.annotations[0]?.name).toBe("Callout");
		expect(document.lines[0]?.annotations[0]?.name).toBe("Tooltip");
		expect(output.value).toContain("// @lw Callout {0-1}");
		expect(output.value).toContain("// @iw Tooltip {0-5}");
	});
});
