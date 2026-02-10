import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import type { AnnotationConfig } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;
const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "plus", kind: "class", class: "diff plus", scopes: ["line"] },
		{ name: "minus", kind: "class", class: "diff minus", scopes: ["line"] },
	],
};

describe("runtime line class diff", () => {
	it("@line plus는 바로 아래 1줄 line scope annotation으로 파싱한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				"// @line plus",
				"const added = 1",
				"const untouched = 0",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["const added = 1", "const untouched = 0"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "plus",
				class: "diff plus",
				range: { start: 0, end: 1 },
			}),
		]);
	});

	it("@line minus range는 닫힌 구간 기준으로 연속된 여러 라인으로 파싱한다", () => {
		const codeNode: Code = {
			type: "code",
			lang: "ts",
			meta: "",
			value: [
				"// @line minus {1-2}",
				"const kept = 0",
				"const removed = 2",
				"const removedToo = 3",
			].join("\n"),
		};

		const document = fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);

		expect(document.lines.map((line) => line.value)).toEqual(["const kept = 0", "const removed = 2", "const removedToo = 3"]);
		expect(document.annotations).toEqual([
			expect.objectContaining({
				scope: "line",
				name: "minus",
				class: "diff minus",
				range: { start: 1, end: 3 },
			}),
		]);
	});
});
