import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../libs";
import type { AnnotationConfig } from "../types";

const {
	getTypePair,
	createAnnotationRegistry,
	resolveAnnotationTypeDefinition,
	resolveAnnotationTypeByScope,
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

	it("통합 설정을 registry로 구성하고 scope별 type 매핑/priority를 부여한다", () => {
		const config: AnnotationConfig = {
			annotations: [
				{ name: "strong", kind: "class", source: "mdast", class: "font-bold", scopes: ["char", "document"] },
				{ name: "emphasis", kind: "class", source: "mdast", class: "italic", scopes: ["char", "document"] },
				{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char", "document"] },
				{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
				{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
			],
		};

		const registry = createAnnotationRegistry(config);

		expect(registry.get("strong")).toMatchObject({
			kind: "class",
			scopes: ["char", "document"],
			source: "mdast",
			priority: 0,
		});
		expect(registry.get("emphasis")).toMatchObject({
			kind: "class",
			scopes: ["char", "document"],
			priority: 1,
		});
		expect(registry.get("Tooltip")).toMatchObject({
			kind: "render",
			scopes: ["char", "document"],
			priority: 0,
		});
		expect(registry.get("diff")).toMatchObject({
			kind: "class",
			scopes: ["line"],
			priority: 0,
		});
		expect(registry.get("Callout")).toMatchObject({
			kind: "render",
			scopes: ["line"],
			priority: 0,
		});

		expect(resolveAnnotationTypeByScope(registry.get("strong")!, "char")).toBe("inlineClass");
		expect(resolveAnnotationTypeByScope(registry.get("Tooltip")!, "document")).toBe("inlineWrap");
		expect(resolveAnnotationTypeByScope(registry.get("diff")!, "line")).toBe("lineClass");
		expect(resolveAnnotationTypeByScope(registry.get("Callout")!, "line")).toBe("lineWrap");
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
