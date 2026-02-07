import type { PhrasingContent } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ as libsTestable } from "../libs";
import { __testable__ } from "../mdast-document-converter";
import type {
	AnnotationAttr,
	AnnotationConfig,
	CodeBlockDocument,
	CodeBlockRoot,
	InlineAnnotation,
	Line,
	LineAnnotation,
	Range,
} from "../types";

const composeCodeBlockRootFromDocument = __testable__.composeCodeBlockRootFromDocument;
const buildCodeBlockDocumentFromMdast = __testable__.buildCodeBlockDocumentFromMdast;
const { createMdxJsxAttributeValueExpression } = libsTestable;

const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "strong", source: "mdast", render: "strong" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
	lineWrap: [
		{ name: "Collapsible", source: "mdx-flow", render: "Collapsible" },
		{ name: "Callout", source: "mdx-flow", render: "Callout" },
	],
};

const inlineWrapByName = new Map(
	(annotationConfig.inlineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineClassByName = new Map(
	(annotationConfig.lineClass ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineWrapByName = new Map(
	(annotationConfig.lineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);

const inlineWrap = (name: string, range: Range, order: number, attributes: AnnotationAttr[] = []): InlineAnnotation => {
	const config = inlineWrapByName.get(name);
	if (!config) throw new Error(`Unknown inlineWrap config: ${name}`);

	return {
		...config,
		type: "inlineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		name,
		range,
		order,
		attributes,
	};
};

const lineWrap = (name: string, range: Range, order: number): LineAnnotation => {
	const config = lineWrapByName.get(name);
	if (!config) throw new Error(`Unknown lineWrap config: ${name}`);

	return {
		...config,
		type: "lineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
		name,
		range,
		order,
	};
};

const lineClass = (name: string, range: Range, order: number): LineAnnotation => {
	const config = lineClassByName.get(name);
	if (!config) throw new Error(`Unknown lineClass config: ${name}`);

	return {
		...config,
		type: "lineClass",
		typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineClass.tag,
		name,
		range,
		order,
	};
};

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

const parse = (document: CodeBlockDocument) => {
	expect(composeCodeBlockRootFromDocument).toBeTypeOf("function");
	return composeCodeBlockRootFromDocument(document, annotationConfig);
};

const documentOf = (partial: Pick<CodeBlockDocument, "lines" | "annotations">): CodeBlockDocument => ({
	lang: "ts",
	meta: { filename: "demo.ts", showLineNumbers: true },
	...partial,
});

const readAttrString = (root: CodeBlockRoot, name: string) => {
	const attr = root.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === name);
	if (!attr || attr.type !== "mdxJsxAttribute") return undefined;
	return typeof attr.value === "string" ? attr.value : undefined;
};

const readMeta = (root: CodeBlockRoot) => {
	const attr = root.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "meta");
	if (!attr || attr.type !== "mdxJsxAttribute" || !attr.value || typeof attr.value === "string") return undefined;
	return JSON.parse(attr.value.value);
};

const readMetaExpressionType = (root: CodeBlockRoot) => {
	const attr = root.attributes.find((node) => node.type === "mdxJsxAttribute" && node.name === "meta");
	if (!attr || attr.type !== "mdxJsxAttribute" || !attr.value || typeof attr.value === "string") return undefined;
	return attr.value.type;
};

const printPhrasing = (nodes: PhrasingContent[]): string => {
	return nodes
		.map((node) => {
			if (node.type === "text") return node.value;

			if (node.type === "mdxJsxTextElement") {
				const attrs = node.attributes
					.map((attr) => {
						if (attr.type !== "mdxJsxAttribute") return "{expr}";
						return `${attr.name}=${JSON.stringify(attr.value)}`;
					})
					.join(",");

				const children = printPhrasing(node.children);
				return attrs.length > 0 ? `${node.name}{${attrs}}(${children})` : `${node.name}(${children})`;
			}

			if ("children" in node) {
				return `${node.type}(${printPhrasing(node.children as PhrasingContent[])})`;
			}

			return node.type;
		})
		.join(" + ");
};

const printCodeBlock = (root: CodeBlockRoot): string => {
	const printBlock = (node: CodeBlockRoot["children"][number]): string => {
		if (node.type === "paragraph") {
			return `p:${printPhrasing(node.children)}`;
		}

		if (node.type === "mdxJsxFlowElement") {
			return `flow:${node.name}[${node.children.map((child) => printBlock(child as MdxJsxFlowElement)).join(" | ")}]`;
		}

		return node.type;
	};

	return root.children.map((node) => printBlock(node)).join("\n");
};

describe("composeCodeBlockRootFromDocument", () => {
	it("CodeBlockDocument -> CodeBlockRoot 변환 함수를 제공한다", () => {
		expect(composeCodeBlockRootFromDocument).toBeTypeOf("function");
	});

	it("annotationConfig 없이 호출하면 에러를 던진다", () => {
		const document = documentOf({ lines: [], annotations: [] });
		expect(() => composeCodeBlockRootFromDocument(document, undefined as never)).toThrowError(
			"[buildAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("빈 document는 children이 빈 CodeBlock root를 반환한다", () => {
		const ast = parse(documentOf({ lines: [], annotations: [] }));
		expect(ast.type).toBe("mdxJsxFlowElement");
		expect(ast.name).toBe("CodeBlock");
		expect(ast.children).toEqual([]);
		expect(readAttrString(ast, "lang")).toBe("ts");
		expect(readMeta(ast)).toEqual({ filename: "demo.ts", showLineNumbers: true });
	});

	it("line 정보만 있으면 paragraph 목록으로 변환한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("line-1"), line("line-2"), line("line-3")],
				annotations: [],
			}),
		);

		expect(printCodeBlock(ast)).toBe("p:line-1\np:line-2\np:line-3");
	});

	it("inline annotation을 적용해 한 줄 paragraph phrasing을 구성한다", () => {
		const ast = parse(
			documentOf({
				lines: [
					line("abcdef", [
						inlineWrap("strong", { start: 1, end: 5 }, 0),
						inlineWrap("Tooltip", { start: 2, end: 4 }, 1, [{ name: "content", value: "tip" }]),
					]),
				],
				annotations: [],
			}),
		);

		expect(printCodeBlock(ast)).toBe('p:a + strong(b + Tooltip{content="tip"}(cd) + e) + f');
	});

	it("동일 range는 priority가 아니라 order 기준으로 중첩 순서를 유지한다", () => {
		const ast = parse(
			documentOf({
				lines: [
					line("text", [inlineWrap("Tooltip", { start: 0, end: 4 }, 0), inlineWrap("u", { start: 0, end: 4 }, 1)]),
				],
				annotations: [],
			}),
		);

		expect(printCodeBlock(ast)).toBe("p:Tooltip(u(text))");
	});

	it("lineWrap annotation을 mdxJsxFlowElement block으로 변환한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("before"), line("inside-1"), line("inside-2"), line("after")],
				annotations: [lineWrap("Collapsible", { start: 1, end: 3 }, 0)],
			}),
		);

		expect(printCodeBlock(ast)).toBe("p:before\nflow:Collapsible[p:inside-1 | p:inside-2]\np:after");
	});

	it("중첩 lineWrap은 중첩 flow block으로 변환한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("outer-1"), line("inner-1"), line("outer-2")],
				annotations: [
					lineWrap("Collapsible", { start: 0, end: 3 }, 0),
					lineWrap("Collapsible", { start: 1, end: 2 }, 1),
				],
			}),
		);

		expect(printCodeBlock(ast)).toBe("flow:Collapsible[p:outer-1 | flow:Collapsible[p:inner-1] | p:outer-2]");
	});

	it("lineClass(diff) annotation도 flow block으로 변환한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("before"), line("changed"), line("after")],
				annotations: [lineClass("diff", { start: 1, end: 2 }, 0)],
			}),
		);

		expect(printCodeBlock(ast)).toBe("p:before\nflow:diff[p:changed]\np:after");
	});

	it("lineWrap(Callout) annotation을 flow block으로 변환한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("a"), line("b"), line("c"), line("d")],
				annotations: [lineWrap("Callout", { start: 1, end: 3 }, 0)],
			}),
		);

		expect(printCodeBlock(ast)).toBe("p:a\nflow:Callout[p:b | p:c]\np:d");
	});

	it("중첩 lineWrap의 flow attributes를 mdast에 보존한다", () => {
		const ast = parse(
			documentOf({
				lines: [line("첫 번째 줄"), line("두 번째 줄"), line("callout 내부"), line("세번째 줄")],
				annotations: [
					lineWrap("Collapsible", { start: 1, end: 3 }, 0),
					{ ...lineWrap("Callout", { start: 2, end: 3 }, 1), attributes: [{ name: "variant", value: "tip" }] },
				],
			}),
		);

		expect(printCodeBlock(ast)).toBe(
			"p:첫 번째 줄\nflow:Collapsible[p:두 번째 줄 | flow:Callout[p:callout 내부]]\np:세번째 줄",
		);

		const collapsible = ast.children[1];
		expect(collapsible?.type).toBe("mdxJsxFlowElement");
		expect(collapsible?.type === "mdxJsxFlowElement" && collapsible.name).toBe("Collapsible");

		const callout = collapsible?.type === "mdxJsxFlowElement" ? collapsible.children[1] : undefined;
		expect(callout?.type).toBe("mdxJsxFlowElement");
		expect(callout?.type === "mdxJsxFlowElement" && callout.name).toBe("Callout");
		expect(callout?.type === "mdxJsxFlowElement" ? callout.attributes : []).toEqual([
			{ type: "mdxJsxAttribute", name: "variant", value: "tip" },
		]);
	});

	it("동일 line range의 lineWrap은 order가 낮은 annotation이 바깥을 감싼다(Callout -> Collapsible)", () => {
		const ast = parse(
			documentOf({
				lines: [line("hello")],
				annotations: [lineWrap("Callout", { start: 0, end: 1 }, 0), lineWrap("Collapsible", { start: 0, end: 1 }, 1)],
			}),
		);

		expect(printCodeBlock(ast)).toBe("flow:Callout[flow:Collapsible[p:hello]]");
	});

	it("동일 line range의 lineWrap은 order 역전 시 중첩 순서도 역전된다(Collapsible -> Callout)", () => {
		const ast = parse(
			documentOf({
				lines: [line("hello")],
				annotations: [lineWrap("Collapsible", { start: 0, end: 1 }, 0), lineWrap("Callout", { start: 0, end: 1 }, 1)],
			}),
		);

		expect(printCodeBlock(ast)).toBe("flow:Collapsible[flow:Callout[p:hello]]");
	});

	it("document.lang/meta를 root attributes로 반영한다", () => {
		const ast = parse({
			lang: "tsx",
			meta: { title: "sample", showLineNumbers: true },
			lines: [line("const a = 1")],
			annotations: [],
		});

		expect(readAttrString(ast, "lang")).toBe("tsx");
		expect(readMetaExpressionType(ast)).toBe("mdxJsxAttributeValueExpression");
		expect(readMeta(ast)).toEqual({ title: "sample", showLineNumbers: true });
	});

	it("document -> mdast -> document에서 lang/meta를 그대로 보존한다", () => {
		const input = {
			lang: "python",
			meta: { filename: "main.py", showLineNumbers: false },
			lines: [line("print('ok')")],
			annotations: [],
		} satisfies CodeBlockDocument;

		const ast = composeCodeBlockRootFromDocument(input, annotationConfig);
		const reconstructed = buildCodeBlockDocumentFromMdast(ast, annotationConfig);

		expect(reconstructed.lang).toBe(input.lang);
		expect(reconstructed.meta).toEqual(input.meta);
	});

	it("document -> mdast -> document 라운드트립에서 lines/annotations/order를 보존한다", () => {
		const input = {
			lang: "ts",
			meta: { title: "roundtrip.ts", showLineNumbers: true },
			lines: [
				line("hello", [inlineWrap("Tooltip", { start: 0, end: 3 }, 0), inlineWrap("u", { start: 3, end: 5 }, 1)]),
				line("world", [inlineWrap("Tooltip", { start: 0, end: 5 }, 0)]),
				line("tail"),
			],
			annotations: [lineClass("diff", { start: 0, end: 1 }, 0), lineWrap("Callout", { start: 1, end: 3 }, 1)],
		} satisfies CodeBlockDocument;

		const ast = composeCodeBlockRootFromDocument(input, annotationConfig);
		const reconstructed = buildCodeBlockDocumentFromMdast(ast, annotationConfig);

		expect(reconstructed).toEqual(input);
	});

	it("복잡한 mdast는 mdast -> document -> mdast 라운드트립에서 유지된다", () => {
		const input: CodeBlockRoot = {
			type: "mdxJsxFlowElement",
			name: "CodeBlock",
			attributes: [
				{ type: "mdxJsxAttribute", name: "lang", value: "ts" },
				{
					type: "mdxJsxAttribute",
					name: "meta",
					value: createMdxJsxAttributeValueExpression({ title: "meta.ts", showLineNumbers: true }),
				},
			],
			children: [
				{
					type: "paragraph",
					children: [
						{ type: "text", value: "pre-" },
						{
							type: "mdxJsxTextElement",
							name: "Tooltip",
							attributes: [{ type: "mdxJsxAttribute", name: "content", value: "tip" }],
							children: [
								{ type: "text", value: "A" },
								{ type: "strong", children: [{ type: "text", value: "B" }] },
							],
						},
						{ type: "text", value: "-post" },
					],
				},
				{
					type: "mdxJsxFlowElement",
					name: "diff",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [
								{ type: "text", value: "line1-" },
								{
									type: "mdxJsxTextElement",
									name: "u",
									attributes: [],
									children: [{ type: "text", value: "U" }],
								},
							],
						},
						{
							type: "paragraph",
							children: [{ type: "text", value: "line2" }],
						},
					],
				},
				{
					type: "mdxJsxFlowElement",
					name: "Callout",
					attributes: [],
					children: [
						{
							type: "paragraph",
							children: [
								{ type: "text", value: "call-" },
								{ type: "strong", children: [{ type: "text", value: "x" }] },
								{ type: "text", value: "-out" },
							],
						},
					],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "tail" }],
				},
			],
		};

		const document = buildCodeBlockDocumentFromMdast(input, annotationConfig);
		const output = composeCodeBlockRootFromDocument(document, annotationConfig);

		expect(output).toEqual(input);
	});
});
