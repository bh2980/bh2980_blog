import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import { __testable__ as documentToCodeFence } from "../document-to-code-fence";
import type { AnnotationConfig, CodeBlockDocument } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;
const { fromCodeBlockDocumentToCodeFence } = documentToCodeFence;

const annotationConfig: AnnotationConfig = {
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

describe("inline absolute range", () => {
	it("code fence 파싱 시 inline range를 코드 블록 절대 offset으로 저장한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["abcde", "// @mark Tooltip {1-3}", "vwxyz"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
		const annotation = document.lines[1]?.annotations[0];

		expect(annotation?.range).toEqual({ start: 7, end: 9 });
	});

	it("code fence 직렬화 시 inline 절대 offset을 line-local range 주석으로 변환한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			lines: [
				{ value: "abcde", annotations: [] },
				{
					value: "vwxyz",
					annotations: [
						{
							type: "inlineWrap",
							typeId: 1,
							tag: "mark",
							source: "mdx-text",
							name: "Tooltip",
							range: { start: 7, end: 9 },
							priority: 0,
							order: 0,
						},
					],
				},
			],
			annotations: [],
		};

		const output = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const lines = output.value.split("\n");

		expect(lines[1]).toContain("@mark Tooltip {1-3}");
	});
});
