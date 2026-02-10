import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import type { AnnotationConfig } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "Collapsible", kind: "render", render: "Collapsible", scopes: ["line"] },
	],
};

describe("line comment pass-through", () => {
	it("기본 파싱에서는 line annotation 주석을 코드 라인으로 유지한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["// @line Collapsible {0-0}", "const a = 1"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig, { parseLineAnnotations: false });

		expect(document.annotations).toEqual([]);
		expect(document.lines.map((line) => line.value)).toEqual(["// @line Collapsible {0-0}", "const a = 1"]);
	});

	it("marker 문법도 parseLineAnnotations=false면 코드 라인으로 유지한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["// @line Collapsible", "const a = 1", "// @line Collapsible end", "const b = 2"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig, { parseLineAnnotations: false });

		expect(document.annotations).toEqual([]);
		expect(document.lines.map((line) => line.value)).toEqual([
			"// @line Collapsible",
			"const a = 1",
			"// @line Collapsible end",
			"const b = 2",
		]);
	});

	it("marker 문법은 parseLineAnnotations=true일 때 @line name end로 닫힌다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			value: ["// @line Collapsible", "const a = 1", "// @line Collapsible end", "const b = 2"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig, { parseLineAnnotations: true });

		expect(document.lines.map((line) => line.value)).toEqual(["const a = 1", "const b = 2"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				type: "lineWrap",
				name: "Collapsible",
				range: { start: 0, end: 1 },
			}),
		]);
	});
});
