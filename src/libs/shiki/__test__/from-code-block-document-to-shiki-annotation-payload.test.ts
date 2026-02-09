import type { DecorationItem } from "shiki";
import { describe, expect, it } from "vitest";
import { fromCodeFenceToCodeBlockDocument } from "@/libs/annotation/code-block/code-fence-to-document";
import type { AnnotationConfig, CodeBlockDocument } from "@/libs/annotation/code-block/types";
import * as remarkModule from "../remark-annotation-to-decoration";

type ComposePayloadResult = {
	code: string;
	lang: string;
	meta: Record<string, unknown>;
	decorations: DecorationItem[];
	lineDecorations: Array<{
		type: "lineClass";
		name: string;
		range: { start: number; end: number };
		class: string;
		order: number;
	}>;
	lineWrappers: Array<{
		type: "lineWrap";
		name: string;
		range: { start: number; end: number };
		render: string;
		order: number;
		attributes?: { name: string; value: unknown }[];
	}>;
};

const fromCodeBlockDocumentToShikiAnnotationPayload = (
	remarkModule as unknown as {
		__testable__?: {
			fromCodeBlockDocumentToShikiAnnotationPayload?: (document: CodeBlockDocument) => ComposePayloadResult;
		};
	}
).__testable__?.fromCodeBlockDocumentToShikiAnnotationPayload;

const testAnnotationConfig: AnnotationConfig = {
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineClass: [{ name: "diff", class: "diff" }],
	lineWrap: [{ name: "Callout", render: "Callout" }],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

describe("fromCodeBlockDocumentToShikiAnnotationPayload", () => {
	it("공통 payload 변환 함수를 제공해야 한다", () => {
		expect(fromCodeBlockDocumentToShikiAnnotationPayload).toBeTypeOf("function");
	});

	it("document를 shiki payload(decorations/lineDecorations/lineWrappers)로 변환해야 한다", () => {
		if (typeof fromCodeBlockDocumentToShikiAnnotationPayload !== "function") {
			throw new Error("fromCodeBlockDocumentToShikiAnnotationPayload is not implemented");
		}

		const document = fromCodeFenceToCodeBlockDocument(
			{
				type: "code",
				lang: "ts",
				meta: 'title="demo.ts" showLineNumbers',
				value: [
					'// @mark Tooltip {6-11} content="tip"',
					"const value = 1",
					'// @block Callout {0-2} variant="tip"',
					"// @line diff {1-2}",
					"const next = 2",
				].join("\n"),
			},
			testAnnotationConfig,
		);

		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document);

		expect(payload.code).toBe("const value = 1\nconst next = 2");
		expect(payload.lang).toBe("ts");
		expect(payload.meta).toEqual({ title: "demo.ts", showLineNumbers: true });

		expect(payload.decorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					start: { line: 0, character: 6 },
					end: { line: 0, character: 11 },
					properties: {
						"data-anno-render": "Tooltip",
						"data-anno-content": '"tip"',
					},
				}),
			]),
		);

		expect(payload.lineDecorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "lineClass",
					name: "diff",
					range: { start: 1, end: 2 },
					class: "diff",
					order: 1,
				}),
			]),
		);

		expect(payload.lineWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "lineWrap",
					name: "Callout",
					range: { start: 0, end: 2 },
					render: "Callout",
					order: 0,
					attributes: [{ name: "variant", value: "tip" }],
				}),
			]),
		);
	});
});
