import { describe, expect, it } from "vitest";
import { __testable__ as codeFenceToDocument } from "../code-fence-to-document";
import { __testable__ as documentToCodeFence } from "../document-to-code-fence";
import { __testable__ as documentToMdast } from "../document-to-mdast";
import { __testable__ as mdastToDocument } from "../mdast-to-document";
import type { AnnotationConfig, CodeBlockDocument } from "../types";

const { fromCodeFenceToCodeBlockDocument } = codeFenceToDocument;
const { fromCodeBlockDocumentToCodeFence } = documentToCodeFence;
const { fromCodeBlockDocumentToMdast } = documentToMdast;
const { fromMdxFlowElementToCodeDocument } = mdastToDocument;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char"] },
		{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char"] },
		{ name: "Collapsible", kind: "render", render: "Collapsible", scopes: ["line"] },
	],
};

const charRender = (name: string, range: { start: number; end: number }, order: number) => ({
	scope: "char" as const,
	source: "mdx-text" as const,
	render: name,
	name,
	range,
	priority: 0,
	order,
	attributes: [],
});

describe("integration roundtrip (new codeblock model)", () => {
	it("document -> code -> document -> mdast -> document에서 inline 절대 offset을 보존한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: { title: "integration.ts", showLineNumbers: true },
			lines: [
				{ value: "const alpha = 1", annotations: [charRender("Tooltip", { start: 6, end: 11 }, 0)] },
				{ value: "return alpha", annotations: [charRender("u", { start: 22, end: 27 }, 0)] },
			],
			annotations: [],
		};

		const code = fromCodeBlockDocumentToCodeFence(input, annotationConfig);
		const parsed = fromCodeFenceToCodeBlockDocument(code, annotationConfig);
		const mdast = fromCodeBlockDocumentToMdast(parsed, annotationConfig);
		const output = fromMdxFlowElementToCodeDocument(mdast, annotationConfig);

		expect(output).toEqual(parsed);
	});
});
