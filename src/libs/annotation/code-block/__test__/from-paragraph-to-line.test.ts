import type { Paragraph, Text } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import { __testable__ as libsTestable } from "../libs";
import { __testable__ } from "../mdast-to-document";
import type { AnnotationAttr, AnnotationConfig, InlineAnnotation, Range } from "../types";

const { fromParagraphToLine } = __testable__;
const { createAnnotationRegistry, supportsAnnotationScope } = libsTestable;
const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "strong", kind: "class" as const, source: "mdast" as const, class: "font-bold", scopes: ["char"] },
		{ name: "emphasis", kind: "class" as const, source: "mdast" as const, class: "italic", scopes: ["char"] },
		{ name: "Tooltip", kind: "render" as const, source: "mdx-text" as const, render: "Tooltip", scopes: ["char"] },
		{ name: "u", kind: "render" as const, source: "mdx-text" as const, render: "u", scopes: ["char"] },
		{ name: "LineBadge", kind: "class" as const, class: "line-badge", scopes: ["line"] },
		{ name: "Collapsible", kind: "render" as const, render: "Collapsible", scopes: ["line"] },
	],
};
const registry = createAnnotationRegistry(annotationConfig);

const text = (value: string): Text => ({ type: "text", value });
const paragraph = (children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children });
type StrongNode = Extract<Paragraph["children"][number], { type: "strong" }>;
type LooseMdxTextAttribute =
	| { type: "mdxJsxAttribute"; name: string; value: unknown }
	| Extract<MdxJsxTextElement["attributes"][number], { type: "mdxJsxExpressionAttribute" }>;
const inline = (
	name: string,
	children: MdxJsxTextElement["children"] = [],
	attributes: LooseMdxTextAttribute[] = [],
): MdxJsxTextElement => ({
	type: "mdxJsxTextElement",
	name,
	attributes: attributes as MdxJsxTextElement["attributes"],
	children,
});
const strong = (children: StrongNode["children"] = []): StrongNode => ({ type: "strong", children });

const expectedInline = (
	registryKey: string,
	name: string,
	range: Range,
	order = 0,
	attributes?: AnnotationAttr[],
): InlineAnnotation => {
	const config = registry.get(registryKey);
	if (!config || !supportsAnnotationScope(config, "char")) {
		throw new Error(`Unknown inline annotation config: ${registryKey}`);
	}

	if (config.kind === "class") {
		return {
			class: config.class ?? "",
			source: config.source,
			priority: config.priority,
			scope: "char",
			name,
			range,
			order,
			...(attributes ? { attributes } : {}),
		};
	}

	return {
		render: config.render ?? name,
		source: config.source,
		priority: config.priority,
		scope: "char",
		name,
		range,
		order,
		...(attributes ? { attributes } : {}),
	};
};

describe("fromParagraphToLine", () => {
	it("paragraph 텍스트를 Line.value로 합친다", () => {
		const line = fromParagraphToLine(paragraph([text("hello"), text(" "), text("world")]), registry);

		expect(line).toEqual({ value: "hello world", annotations: [] });
	});

	it("mdast inline annotation은 InlineAnnotation으로 반환한다", () => {
		const line = fromParagraphToLine(paragraph([text("x"), strong([text("ab")]), text("y")]), registry);

		expect(line).toEqual({
			value: "xaby",
			annotations: [expectedInline("strong", "strong", { start: 1, end: 3 })],
		});
	});

	it("mdx-text inline annotation은 named attribute를 값 타입 그대로 보존한다", () => {
		const line = fromParagraphToLine(
			paragraph([
				text("a"),
				inline(
					"Tooltip",
					[text("bc")],
					[
						{ type: "mdxJsxAttribute", name: "title", value: "hint" },
						{ type: "mdxJsxAttribute", name: "enabled", value: true },
						{ type: "mdxJsxExpressionAttribute", value: "{x}" },
					],
				),
				text("d"),
			]),
			registry,
		);

		expect(line).toEqual({
			value: "abcd",
			annotations: [
				expectedInline("Tooltip", "Tooltip", { start: 1, end: 3 }, 0, [
					{ name: "title", value: "hint" },
					{ name: "enabled", value: true },
				]),
			],
		});
	});

	it("line 타입 registry 항목은 Line.annotations에 포함되지 않는다", () => {
		const line = fromParagraphToLine(
			paragraph([inline("Collapsible", [text("x")]), inline("LineBadge", [text("y")])]),
			registry,
		);

		expect(line).toEqual({ value: "xy", annotations: [] });
	});

	it("알 수 없는 inline node는 annotation 없이 텍스트만 반영한다", () => {
		const line = fromParagraphToLine(paragraph([inline("Unknown", [text("a")]), text("b")]), registry);

		expect(line).toEqual({ value: "ab", annotations: [] });
	});

	it("중첩된 inline annotation도 모두 InlineAnnotation 타입으로 반환한다", () => {
		const line = fromParagraphToLine(
			paragraph([inline("u", [text("a"), strong([text("b")]), inline("Tooltip", [text("c")])]), text("d")]),
			registry,
		);

		expect(line.value).toBe("abcd");
		expect(line.annotations).toEqual(
			expect.arrayContaining([
				expectedInline("strong", "strong", { start: 1, end: 2 }, 0),
				expectedInline("Tooltip", "Tooltip", { start: 2, end: 3 }, 1, []),
				expectedInline("u", "u", { start: 0, end: 3 }, 2, []),
			]),
		);
		expect(line.annotations.every((annotation) => annotation.scope === "char")).toBe(true);
	});

	it("빈 paragraph는 빈 Line을 반환한다", () => {
		const line = fromParagraphToLine(paragraph([]), registry);

		expect(line).toEqual({ value: "", annotations: [] });
	});
});
