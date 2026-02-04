import type { PhrasingContent, Root, RootContent } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ } from "../keystatic-annotation-manager";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import type { AnnotationAttr, AnnotationConfig, CodeBlockDocument, InlineAnnotation, Line, LineAnnotation, Range } from "../types";

type ParseMdastFromCodeBlockDocument = (document: CodeBlockDocument) => Root;

const parseMdastFromCodeBlockDocument = (
	__testable__ as unknown as {
		parseMdastFromCodeBlockDocument?: ParseMdastFromCodeBlockDocument;
	}
).parseMdastFromCodeBlockDocument;

const annotationConfig: AnnotationConfig = {
	inlineClass: [],
	inlineWrap: [
		{ name: "Tooltip", source: "mdx-text", render: "Tooltip" },
		{ name: "strong", source: "mdast", render: "strong" },
		{ name: "u", source: "mdx-text", render: "u" },
	],
	lineClass: [],
	lineWrap: [{ name: "Collapsible", source: "mdx-flow", render: "Collapsible" }],
};

const inlineWrapByName = new Map(
	(annotationConfig.inlineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);
const lineWrapByName = new Map(
	(annotationConfig.lineWrap ?? []).map((item, priority) => [item.name, { ...item, priority }]),
);

const inlineWrap = (name: string, range: Range, attributes: AnnotationAttr[] = []): InlineAnnotation => {
	const config = inlineWrapByName.get(name);
	if (!config) throw new Error(`Unknown inlineWrap config: ${name}`);

	return {
		...config,
		type: "inlineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
		name,
		range,
		attributes,
	};
};

const lineWrap = (name: string, range: Range): LineAnnotation => {
	const config = lineWrapByName.get(name);
	if (!config) throw new Error(`Unknown lineWrap config: ${name}`);

	return {
		...config,
		type: "lineWrap",
		typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
		tag: ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
		name,
		range,
	};
};

const line = (value: string, annotations: InlineAnnotation[] = []): Line => ({ value, annotations });

const parse = (document: CodeBlockDocument) => {
	expect(parseMdastFromCodeBlockDocument).toBeTypeOf("function");
	return parseMdastFromCodeBlockDocument!(document);
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

const printRoot = (root: Root): string => {
	const printBlock = (node: RootContent): string => {
		if (node.type === "paragraph") {
			return `p:${printPhrasing(node.children)}`;
		}

		if (node.type === "mdxJsxFlowElement") {
			return `flow:${node.name}[${node.children.map((child) => printBlock(child as RootContent)).join(" | ")}]`;
		}

		return node.type;
	};

	return root.children.map((node) => printBlock(node)).join("\n");
};

describe("parseMdastFromCodeBlockDocument", () => {
	it("CodeBlockDocument -> Root 변환 함수를 제공한다", () => {
		expect(parseMdastFromCodeBlockDocument).toBeTypeOf("function");
	});

	it("빈 document는 빈 root를 반환한다", () => {
		const ast = parse({ lines: [], annotations: [] });
		expect(ast).toEqual({ type: "root", children: [] });
	});

	it("line 정보만 있으면 paragraph 목록으로 변환한다", () => {
		const ast = parse({
			lines: [line("line-1"), line("line-2"), line("line-3")],
			annotations: [],
		});

		expect(printRoot(ast)).toBe("p:line-1\np:line-2\np:line-3");
	});

	it("inline annotation을 적용해 한 줄 paragraph phrasing을 구성한다", () => {
		const ast = parse({
			lines: [
				line("abcdef", [
					inlineWrap("strong", { start: 1, end: 5 }),
					inlineWrap("Tooltip", { start: 2, end: 4 }, [{ name: "content", value: "tip" }]),
				]),
			],
			annotations: [],
		});

		expect(printRoot(ast)).toBe('p:a + strong(b + Tooltip{content="tip"}(cd) + e) + f');
	});

	it("동일 range는 priority 기준으로 중첩 순서를 유지한다", () => {
		const ast = parse({
			lines: [line("text", [inlineWrap("Tooltip", { start: 0, end: 4 }), inlineWrap("u", { start: 0, end: 4 })])],
			annotations: [],
		});

		expect(printRoot(ast)).toBe("p:Tooltip(u(text))");
	});

	it("lineWrap annotation을 mdxJsxFlowElement block으로 변환한다", () => {
		const ast = parse({
			lines: [line("before"), line("inside-1"), line("inside-2"), line("after")],
			annotations: [lineWrap("Collapsible", { start: 1, end: 3 })],
		});

		expect(printRoot(ast)).toBe("p:before\nflow:Collapsible[p:inside-1 | p:inside-2]\np:after");
	});

	it("중첩 lineWrap은 중첩 flow block으로 변환한다", () => {
		const ast = parse({
			lines: [line("outer-1"), line("inner-1"), line("outer-2")],
			annotations: [lineWrap("Collapsible", { start: 0, end: 3 }), lineWrap("Collapsible", { start: 1, end: 2 })],
		});

		expect(printRoot(ast)).toBe("flow:Collapsible[p:outer-1 | flow:Collapsible[p:inner-1] | p:outer-2]");
	});
});
