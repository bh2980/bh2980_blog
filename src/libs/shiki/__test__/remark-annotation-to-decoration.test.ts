import type { Code, Root } from "mdast";
import { describe, expect, it } from "vitest";
import { remarkAnnotationToShikiDecoration } from "../remark-annotation-to-decoration";

type AnnotationConfig = Parameters<typeof remarkAnnotationToShikiDecoration>[0];

const markOnlyConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineClass: [],
	lineWrap: [],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

const decOnlyConfig: AnnotationConfig = {
	inlineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	inlineWrap: [],
	lineClass: [],
	lineWrap: [],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

const fullConfig: AnnotationConfig = {
	inlineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
	lineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
	tagOverrides: {
		inlineClass: "dec",
		inlineWrap: "mark",
		lineClass: "line",
		lineWrap: "block",
	},
};

const getCodeNode = (root: Root) => root.children[0] as Code;
const getHProperties = (code: Code) => (code.data?.hProperties ?? {}) as Record<string, unknown>;

describe("remarkAnnotationToShikiDecoration", () => {
	it("mark annotation을 decoration으로 변환하고 annotation 라인을 제거한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: 'title="demo.ts" showLineNumbers',
					value: ['// @mark Tooltip {0-5} content="tip"', "hello world"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe("hello world");
		expect(decorations).toHaveLength(1);
		expect(decorations[0]).toMatchObject({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 5 },
			properties: {
				"data-anno-render": "Tooltip",
				"data-anno-content": '"tip"',
			},
		});
	});

	it("python 같은 // 이외 주석 prefix에서도 annotation을 파싱해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "python",
					meta: "",
					value: ['# @mark Tooltip {0-5} content="tip"', "print('hello')"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe("print('hello')");
		expect(decorations).toHaveLength(1);
	});

	it("postcss의 /* */ postfix 주석 annotation도 파싱해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "postcss",
					meta: "",
					value: ['/* @mark Tooltip {0-5} content="tip" */', ".button {}"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe(".button {}");
		expect(decorations).toHaveLength(1);
		expect(decorations[0]).toMatchObject({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 5 },
		});
	});

	it("dec annotation은 inline class decoration으로 변환한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: ["// @dec diff {0-5}", "hello world"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(decOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe("hello world");
		expect(decorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					start: { line: 0, character: 0 },
					end: { line: 0, character: 5 },
					properties: { class: "diff" },
				}),
			]),
		);
	});

	it("설정에 없는 annotation 라인은 코드 라인으로 보존한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: ["// @mark Unknown {0-5}", "hello"].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(markOnlyConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const decorations = JSON.parse(String(hProperties["data-decorations"] ?? "[]"));

		expect(code.value).toBe(["// @mark Unknown {0-5}", "hello"].join("\n"));
		expect(decorations).toEqual([]);
	});

	it("line/block annotation을 line-decorations / line-wrappers payload로 분리 보존해야 한다", () => {
		const root: Root = {
			type: "root",
			children: [
				{
					type: "code",
					lang: "ts",
					meta: "",
					value: [
						'// @block Callout {0-2} variant="tip"',
						"// @line diff {1-2}",
						"const first = 1",
						"const second = 2",
					].join("\n"),
				},
			],
		};

		remarkAnnotationToShikiDecoration(fullConfig)(root);

		const code = getCodeNode(root);
		const hProperties = getHProperties(code);
		const lineDecorations = JSON.parse(String(hProperties["data-line-decorations"] ?? "[]"));
		const lineWrappers = JSON.parse(String(hProperties["data-line-wrappers"] ?? "[]"));

		expect(code.value).toBe(["const first = 1", "const second = 2"].join("\n"));
		expect(lineWrappers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					tag: "block",
					name: "Callout",
					range: { start: 0, end: 2 },
					attributes: [{ name: "variant", value: "tip" }],
				}),
			]),
		);
		expect(lineDecorations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					tag: "line",
					name: "diff",
					range: { start: 1, end: 2 },
				}),
			]),
		);
	});
});
