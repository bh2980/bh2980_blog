import { describe, expect, it } from "vitest";
import { __testable__ as documentToMdast } from "../document-to-mdast";
import type { AnnotationConfig, CodeBlockDocument } from "../types";

const { fromCodeBlockDocumentToMdast } = documentToMdast;

const annotationConfig: AnnotationConfig = {
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineWrap: [{ name: "Collapsible", render: "Collapsible" }],
};

describe("single paragraph structure", () => {
	it("document를 단일 paragraph + break 구조로 변환한다", () => {
		const input: CodeBlockDocument = {
			lang: "ts",
			meta: {},
			lines: [
				{ value: "const a = 1", annotations: [] },
				{ value: "const b = 2", annotations: [] },
			],
			annotations: [],
		};

		const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);

		expect(ast.children).toHaveLength(1);
		const paragraph = ast.children[0];
		expect(paragraph?.type).toBe("paragraph");
		if (!paragraph || paragraph.type !== "paragraph") {
			throw new Error("paragraph not found");
		}

		expect(paragraph.children).toEqual([
			{ type: "text", value: "const a = 1" },
			{ type: "break" },
			{ type: "text", value: "const b = 2" },
		]);
	});
});

it("line annotation 데이터가 있어도 flow wrapper를 만들지 않는다", () => {
	const input: CodeBlockDocument = {
		lang: "ts",
		meta: {},
		lines: [{ value: "const a = 1", annotations: [] }],
		annotations: [
			{
				type: "lineWrap",
				typeId: 3,
				tag: "block",
				name: "Collapsible",
				range: { start: 0, end: 1 },
				priority: 0,
				order: 0,
			},
		],
	};

	const ast = fromCodeBlockDocumentToMdast(input, annotationConfig);

	expect(ast.children).toHaveLength(1);
	expect(ast.children[0]).toMatchObject({ type: "paragraph" });
	expect(ast.children.some((child) => child.type === "mdxJsxFlowElement")).toBe(false);
});
