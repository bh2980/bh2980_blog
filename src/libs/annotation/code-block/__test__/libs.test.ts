import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const { createAnnotationRegistry, createMdxJsxAttributeValueExpression } = __testable__;

describe("createAnnotationRegistry", () => {
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

		expect(registry.get("strong")).toEqual({
			name: "strong",
			source: "mdast",
			class: "font-bold",
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
			priority: 0,
		});
		expect(registry.get("emphasis")).toEqual({
			name: "emphasis",
			source: "mdast",
			class: "italic",
			type: "inlineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineClass.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineClass.tag,
			priority: 1,
		});
		expect(registry.get("Tooltip")).toEqual({
			name: "Tooltip",
			source: "mdx-text",
			render: "Tooltip",
			type: "inlineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.inlineWrap.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.inlineWrap.tag,
			priority: 0,
		});
		expect(registry.get("diff")).toEqual({
			name: "diff",
			source: "mdx-flow",
			class: "diff",
			type: "lineClass",
			typeId: ANNOTATION_TYPE_DEFINITION.lineClass.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.lineClass.tag,
			priority: 0,
		});
		expect(registry.get("Callout")).toEqual({
			name: "Callout",
			source: "mdx-flow",
			render: "Callout",
			type: "lineWrap",
			typeId: ANNOTATION_TYPE_DEFINITION.lineWrap.typeId,
			tag: ANNOTATION_TYPE_DEFINITION.lineWrap.tag,
			priority: 0,
		});
	});

	it("tagOverrides가 있으면 기본 tag 대신 override tag를 사용한다", () => {
		const config: AnnotationConfig = {
			inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
			lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
			tagOverrides: {
				inlineWrap: " mark ",
				lineWrap: "block",
			},
		};

		const registry = createAnnotationRegistry(config);

		expect(registry.get("Tooltip")?.tag).toBe("mark");
		expect(registry.get("Callout")?.tag).toBe("block");
	});

	it("tagOverrides에 형식이 잘못된 tag가 있으면 에러를 던진다", () => {
		const config: AnnotationConfig = {
			inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
			tagOverrides: {
				inlineWrap: "1bad-tag",
			},
		};

		expect(() => createAnnotationRegistry(config)).toThrowError(
			'[buildAnnotationRegistry] ERROR : invalid annotation tag "1bad-tag" for type "inlineWrap"',
		);
	});

	it("서로 다른 type이 같은 override tag를 쓰면 에러를 던진다", () => {
		const config: AnnotationConfig = {
			inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
			lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
			tagOverrides: {
				inlineWrap: "wrap",
				lineWrap: "wrap",
			},
		};

		expect(() => createAnnotationRegistry(config)).toThrowError(
			'[buildAnnotationRegistry] ERROR : duplicated annotation tag "wrap"',
		);
	});
});

describe("createMdxJsxAttributeValueExpression", () => {
	it("JSON 값을 mdxJsxAttributeValueExpression로 생성한다", () => {
		const value = { title: "meta.ts", showLineNumbers: true };
		const expression = createMdxJsxAttributeValueExpression(value);

		expect(expression.type).toBe("mdxJsxAttributeValueExpression");
		expect(expression.value).toBe(JSON.stringify(value));
		expect(expression.data?.estree?.type).toBe("Program");
		expect(expression.data?.estree?.body[0]?.type).toBe("ExpressionStatement");
	});
});
