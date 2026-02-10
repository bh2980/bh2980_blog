import { describe, expect, it } from "vitest";
import { __testable__ as mdastToDocument } from "../mdast-to-document";
import type { AnnotationConfig, CodeBlockRoot } from "../types";

const { fromMdxFlowElementToCodeDocument } = mdastToDocument;

const annotationConfig: AnnotationConfig = {
	annotations: [{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] }],
};

describe("hard break parse", () => {
	it("단일 paragraph 내부의 break를 줄 경계로 파싱한다", () => {
		const input: CodeBlockRoot = {
			type: "mdxJsxFlowElement",
			name: "CodeBlock",
			attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "ts" }],
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "const a = 1" }, { type: "break" }, { type: "text", value: "const b = 2" }],
				},
			],
		};

		const document = fromMdxFlowElementToCodeDocument(input, annotationConfig);

		expect(document.lines).toEqual([
			{ value: "const a = 1", annotations: [] },
			{ value: "const b = 2", annotations: [] },
		]);
	});
});
