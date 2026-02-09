import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import { codeFenceAnnotationConfig } from "../constants";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;

describe("runtime line class diff", () => {
	it("@line plus/minus를 lineClass annotation으로 파싱한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				"// @line plus {0-1}",
				"const added = 1",
				"// @line minus",
				"const removed = 2",
				"// @end line minus",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, codeFenceAnnotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["const added = 1", "const removed = 2"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				type: "lineClass",
				name: "plus",
				class: "diff plus",
				range: { start: 0, end: 1 },
			}),
			expect.objectContaining({
				type: "lineClass",
				name: "minus",
				class: "diff minus",
				range: { start: 1, end: 2 },
			}),
		]);
	});
});
