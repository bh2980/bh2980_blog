import type { Element, Root } from "hast";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../code-highligher", () => ({
	highlight: vi.fn(),
}));

import { highlight } from "../code-highligher";
import { rehypeShikiDecorationRender } from "../rehype-shiki-decoration-render";

const highlightMock = vi.mocked(highlight);

const createTree = (pre: Element): Root => ({
	type: "root",
	children: [pre],
});

const createPreWithCode = ({
	codeValue,
	codeClassName = ["language-ts"],
	preData = {},
	codeData = {},
}: {
	codeValue: string;
	codeClassName?: Array<string>;
	preData?: Element["properties"];
	codeData?: Element["properties"];
}): Element => ({
	type: "element",
	tagName: "pre",
	properties: preData,
	children: [
		{
			type: "element",
			tagName: "code",
			properties: {
				className: codeClassName,
				...codeData,
			},
			children: [{ type: "text", value: codeValue }],
		},
	],
});

describe("rehypeShikiDecorationRender", () => {
	beforeEach(() => {
		highlightMock.mockReset();
	});

	it("pre/code의 data-* payload를 파싱해서 highlight에 전달하고 pre를 교체한다", async () => {
		const renderedPre: Element = {
			type: "element",
			tagName: "pre",
			properties: { "data-rendered": true },
			children: [],
		};
		highlightMock.mockReturnValue({
			type: "root",
			children: [renderedPre],
		});

		const pre = createPreWithCode({
			codeValue: "const a = 1;\n",
			preData: {
				"data-meta": '{"title":"demo.ts"}',
				"data-decorations":
					'[{"start":{"line":0,"character":0},"end":{"line":0,"character":5},"properties":{"class":"diff"}}]',
				"data-line-decorations": '[{"type":"lineClass","name":"diff","range":{"start":0,"end":1},"class":"diff"}]',
				"data-line-wrappers":
					'[{"type":"lineWrap","name":"Callout","range":{"start":0,"end":1},"order":0,"render":"Callout","attributes":[{"name":"variant","value":"tip"}]}]',
				"data-render-tags": '["Tooltip","Callout"]',
			},
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).toHaveBeenCalledTimes(1);
		expect(highlightMock).toHaveBeenCalledWith(
			"const a = 1;",
			"ts",
			{ title: "demo.ts" },
			{
				decorations: [
					{
						start: { line: 0, character: 0 },
						end: { line: 0, character: 5 },
						properties: { class: "diff" },
					},
				],
				lineDecorations: [{ type: "lineClass", name: "diff", range: { start: 0, end: 1 }, class: "diff" }],
				lineWrappers: [
					{
						type: "lineWrap",
						name: "Callout",
						range: { start: 0, end: 1 },
						order: 0,
						render: "Callout",
						attributes: [{ name: "variant", value: "tip" }],
					},
				],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);
		expect(tree.children[0]).toBe(renderedPre);
	});

	it("pre에 data가 없으면 code의 data-*를 fallback으로 사용한다", async () => {
		const renderedPre: Element = {
			type: "element",
			tagName: "pre",
			properties: {},
			children: [],
		};
		highlightMock.mockReturnValue({
			type: "root",
			children: [renderedPre],
		});

		const pre = createPreWithCode({
			codeValue: "print('hello')\n",
			codeClassName: ["language-python"],
			codeData: {
				"data-meta": '{"showLineNumbers":true}',
				"data-decorations": "[]",
				"data-line-decorations": "[]",
				"data-line-wrappers": "[]",
				"data-render-tags": '["Tooltip","Callout"]',
			},
		});
		const tree = createTree(pre);

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).toHaveBeenCalledWith(
			"print('hello')",
			"python",
			{ showLineNumbers: true },
			{
				decorations: [],
				lineDecorations: [],
				lineWrappers: [],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);
	});

	it("code child가 없으면 skip한다", async () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "element",
					tagName: "pre",
					properties: {},
					children: [{ type: "text", value: "no code child" }],
				},
			],
		};

		await rehypeShikiDecorationRender()(tree);

		expect(highlightMock).not.toHaveBeenCalled();
	});
});
