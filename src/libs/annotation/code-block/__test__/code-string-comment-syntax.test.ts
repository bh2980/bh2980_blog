import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ as fromCodeBlockDocumentToCodeFenceTestable } from "../document-to-code-fence";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
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
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineClass: [],
	lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
};

const inlineWrapByName = new Map(
	(annotationConfig.inlineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineWrapByName = new Map(
	(annotationConfig.lineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);

const inWrapTag = ANNOTATION_TYPE_DEFINITION.inlineWrap.tag;
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

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

describe("code-string converter comment syntax", () => {
	it("postcss의 /* */ 주석 annotation 라인을 파싱한다", () => {
		const input: Code = {
			type: "code",
			lang: "postcss",
			meta: "",
			value: [
				`/* @${lnWrapTag} Callout {0-2} tone="info" */`,
				`/* @${inWrapTag} Tooltip {0-5} content="tip" */`,
				"hello",
				"world",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(input, annotationConfig);

		expect(document).toEqual({
			lang: "postcss",
			meta: {},
			annotations: [lineWrap("Callout", { start: 0, end: 2 }, 0, [{ name: "tone", value: "info" }])],
			lines: [
				line("hello", [inlineWrap("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])]),
				line("world"),
			],
		});
	});

	it("postcss 직렬화 시 annotation 라인에 /* */ postfix를 유지한다", () => {
		const input: CodeBlockDocument = {
			lang: "postcss",
			meta: {},
			annotations: [lineWrap("Callout", { start: 0, end: 2 }, 0)],
			lines: [
				line("hello", [inlineWrap("Tooltip", { start: 0, end: 5 }, 0, [{ name: "content", value: "tip" }])]),
				line("world"),
			],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);

		expect(output.value).toBe(
			[`/* @${lnWrapTag} Callout {0-2} */`, `/* @${inWrapTag} Tooltip {0-5} content="tip" */`, "hello", "world"].join(
				"\n",
			),
		);
	});
});
