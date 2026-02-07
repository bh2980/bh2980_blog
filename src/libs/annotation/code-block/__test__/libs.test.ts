import type { Node, PhrasingContent } from "mdast";
import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const {
	hasChildren,
	getTypePair,
	createAnnotationRegistry,
	resolveAnnotationTypeDefinition,
	isText,
	isBreak,
	isMDXJSXTextElement,
	createBreakNode,
	createTextNode,
	createMdastNode,
	createMdxJsxTextElementNode,
	toMdxJsxAttributeValueExpression,
	composeEventsFromAnnotations,
} = __testable__;

describe("type guard / node helper", () => {
	it("hasChildren는 children 유무를 기준으로 판별한다", () => {
		const textNode = { type: "text", value: "x" } as Node;
		const paragraphNode = { type: "paragraph", children: [textNode] } as Node;

		expect(hasChildren(textNode)).toBe(false);
		expect(hasChildren(paragraphNode)).toBe(true);
	});

	it("isText / isBreak / isMDXJSXTextElement가 노드 타입을 정확히 판별한다", () => {
		const textNode = createTextNode("hello");
		const breakNode = createBreakNode();
		const mdxTextNode = createMdxJsxTextElementNode("Tooltip", [], []);

		expect(isText(textNode)).toBe(true);
		expect(isBreak(textNode)).toBe(false);
		expect(isMDXJSXTextElement(textNode)).toBe(false);

		expect(isBreak(breakNode)).toBe(true);
		expect(isText(breakNode)).toBe(false);

		expect(isMDXJSXTextElement(mdxTextNode)).toBe(true);
		expect(isText(mdxTextNode)).toBe(false);
	});

	it("createTextNode / createBreakNode / createMdastNode가 기본 노드를 생성한다", () => {
		const textNode = createTextNode("abc");
		const breakNode = createBreakNode();
		const strongNode = createMdastNode("strong", [textNode]);

		expect(textNode).toEqual({ type: "text", value: "abc" });
		expect(breakNode).toEqual({ type: "break" });
		expect(strongNode).toEqual({
			type: "strong",
			children: [{ type: "text", value: "abc" }],
		});
	});

	it("createMdxJsxTextElementNode는 primitive/value-expression attribute를 모두 보존한다", () => {
		const children: PhrasingContent[] = [createTextNode("hello")];
		const node = createMdxJsxTextElementNode(
			"Tooltip",
			[
				{ name: "content", value: "tip" },
				{ name: "collapsed", value: null },
				{ name: "optional", value: undefined },
				{ name: "open", value: true },
				{ name: "count", value: 1 },
				{ name: "meta", value: { a: 1 } },
				{ name: "items", value: [1, "x"] },
			],
			children,
		);

		expect(node.type).toBe("mdxJsxTextElement");
		expect(node.name).toBe("Tooltip");
		expect(node.children).toEqual(children);

		const attrs = node.attributes.filter((attr) => attr.type === "mdxJsxAttribute");
		const byName = Object.fromEntries(attrs.map((attr) => [attr.name, attr.value]));

		expect(byName.content).toBe("tip");
		expect(byName.collapsed).toBeNull();
		expect(byName.optional).toBeUndefined();
		expect(byName.open).toMatchObject({ type: "mdxJsxAttributeValueExpression", value: "true" });
		expect(byName.count).toMatchObject({ type: "mdxJsxAttributeValueExpression", value: "1" });
		expect(byName.meta).toMatchObject({ type: "mdxJsxAttributeValueExpression", value: '{"a":1}' });
		expect(byName.items).toMatchObject({ type: "mdxJsxAttributeValueExpression", value: '[1,"x"]' });
	});
});

describe("resolveAnnotationTypeDefinition", () => {
	it("기본 tag definition을 그대로 반환한다", () => {
		const resolved = resolveAnnotationTypeDefinition({});

		expect(resolved.inlineClass).toEqual(ANNOTATION_TYPE_DEFINITION.inlineClass);
		expect(resolved.inlineWrap).toEqual(ANNOTATION_TYPE_DEFINITION.inlineWrap);
		expect(resolved.lineClass).toEqual(ANNOTATION_TYPE_DEFINITION.lineClass);
		expect(resolved.lineWrap).toEqual(ANNOTATION_TYPE_DEFINITION.lineWrap);
	});

	it("tagOverrides를 trim하여 반영한다", () => {
		const resolved = resolveAnnotationTypeDefinition({
			tagOverrides: {
				inlineWrap: " mark ",
				lineWrap: " block ",
			},
		});

		expect(resolved.inlineWrap.tag).toBe("mark");
		expect(resolved.lineWrap.tag).toBe("block");
	});

	it("유효하지 않은 tag 형식이면 에러를 던진다", () => {
		expect(() =>
			resolveAnnotationTypeDefinition({
				tagOverrides: { inlineClass: "1bad" },
			}),
		).toThrowError('[buildAnnotationRegistry] ERROR : invalid annotation tag "1bad" for type "inlineClass"');
	});

	it("서로 다른 type에 동일 tag를 주면 에러를 던진다", () => {
		expect(() =>
			resolveAnnotationTypeDefinition({
				tagOverrides: {
					inlineClass: "dup",
					inlineWrap: "dup",
				},
			}),
		).toThrowError('[buildAnnotationRegistry] ERROR : duplicated annotation tag "dup"');
	});
});

describe("createAnnotationRegistry / getTypePair", () => {
	it("annotationConfig가 없으면 에러를 던진다", () => {
		expect(() => createAnnotationRegistry(undefined)).toThrowError(
			"[buildAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("타입별 설정을 registry로 구성하고 priority를 배열 순서로 부여한다", () => {
		const config: AnnotationConfig = {
			inlineClass: [
				{ name: "strong", source: "mdast", class: "font-bold" },
				{ name: "emphasis", source: "mdast", class: "italic" },
			],
			inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
			lineClass: [{ name: "diff", source: "mdx-flow", class: "diff" }],
			lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
		};

		const registry = createAnnotationRegistry(config);

		expect(registry.get("strong")).toMatchObject({
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			priority: 0,
		});
		expect(registry.get("emphasis")).toMatchObject({
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			priority: 1,
		});
		expect(registry.get("Tooltip")).toMatchObject({
			type: "inlineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			priority: 0,
		});
		expect(registry.get("diff")).toMatchObject({
			type: "lineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
			priority: 0,
		});
		expect(registry.get("Callout")).toMatchObject({
			type: "lineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
			priority: 0,
		});
	});

	it("getTypePair는 type별 typeId/tag를 정확히 매핑한다", () => {
		const definition = resolveAnnotationTypeDefinition({
			tagOverrides: { lineWrap: "block" },
		});

		expect(getTypePair("lineWrap", definition)).toEqual({
			type: "lineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
			tag: "block",
		});
	});
});

describe("toMdxJsxAttributeValueExpression", () => {
	it("객체/스칼라 값을 mdxJsxAttributeValueExpression으로 변환한다", () => {
		const objectValue = { title: "meta.ts", showLineNumbers: true };
		const objectExpression = toMdxJsxAttributeValueExpression(objectValue);
		expect(objectExpression.type).toBe("mdxJsxAttributeValueExpression");
		expect(objectExpression.value).toBe('{"title":"meta.ts","showLineNumbers":true}');
		expect(objectExpression.data?.estree?.type).toBe("Program");
		expect(objectExpression.data?.estree?.body[0]?.type).toBe("ExpressionStatement");

		const scalarExpression = toMdxJsxAttributeValueExpression(true);
		expect(scalarExpression.value).toBe("true");
	});
});

describe("composeEventsFromAnnotations", () => {
	it("기본 이벤트 정렬 함수를 제공한다", () => {
		const events = composeEventsFromAnnotations([
			{
				type: "inlineWrap",
				typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
				tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
				source: "mdx-text",
				name: "Tooltip",
				range: { start: 0, end: 4 },
				priority: 0,
				order: 0,
			},
		]);

		expect(events).toEqual([
			expect.objectContaining({ kind: "open", pos: 0 }),
			expect.objectContaining({ kind: "close", pos: 4 }),
		]);
	});
});
