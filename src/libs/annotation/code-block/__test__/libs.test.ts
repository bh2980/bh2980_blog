import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const {
	getTypePair,
	createAnnotationRegistry,
	resolveAnnotationTypeDefinition,
	fromAnnotationsToEvents,
} = __testable__;

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
		).toThrowError('[createAnnotationRegistry] ERROR : invalid annotation tag "1bad" for type "inlineClass"');
	});

	it("서로 다른 type에 동일 tag를 주면 에러를 던진다", () => {
		expect(() =>
			resolveAnnotationTypeDefinition({
				tagOverrides: {
					inlineClass: "dup",
					inlineWrap: "dup",
				},
			}),
		).toThrowError('[createAnnotationRegistry] ERROR : duplicated annotation tag "dup"');
	});
});

describe("createAnnotationRegistry / getTypePair", () => {
	it("annotationConfig가 없으면 에러를 던진다", () => {
		expect(() => createAnnotationRegistry(undefined)).toThrowError(
			"[createAnnotationRegistry] ERROR : annotationConfig is required",
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

describe("fromAnnotationsToEvents", () => {
	it("기본 이벤트 정렬 함수를 제공한다", () => {
		const events = fromAnnotationsToEvents([
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
