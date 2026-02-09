import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import type { AnnotationConfig } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;

const annotationConfig: AnnotationConfig = {
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineWrap: [{ name: "Collapsible", source: "mdx-flow", render: "Collapsible" }],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

describe("line comment pass-through", () => {
	it("기본 파싱에서는 line annotation 주석을 코드 라인으로 유지한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["// @block Collapsible {0-1}", "const a = 1"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig, { parseLineAnnotations: false });

		expect(document.annotations).toEqual([]);
		expect(document.lines.map((line) => line.value)).toEqual(["// @block Collapsible {0-1}", "const a = 1"]);
	});
});
