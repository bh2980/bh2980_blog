import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import type { AnnotationConfig } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;
const annotationConfig: AnnotationConfig = {
	annotations: [{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] }],
};

describe("runtime fold inline annotation", () => {
	it("@char fold 주석을 inlineWrap으로 파싱한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: ["// @char fold {0-4}", "hello world"].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["hello world"]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				type: "inlineWrap",
				name: "fold",
				render: "fold",
				range: { start: 0, end: 5 },
			}),
		]);
	});
});
