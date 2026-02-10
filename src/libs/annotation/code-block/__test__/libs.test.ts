import { describe, expect, it } from "vitest";
import { __testable__ } from "../libs";
import type { Annotation, AnnotationConfig, Range } from "../types";

const { normalizeConfigItems, createAnnotationRegistry, resolveAnnotationTypeByScope, fromAnnotationsToEvents } =
	__testable__;

const makeAnnotation = ({
	type,
	name,
	range,
	order,
	priority = 0,
	source = "mdx-text",
}: {
	type: Annotation["type"];
	name: string;
	range: Range;
	order: number;
	priority?: number;
	source?: "mdast" | "mdx-text";
}): Annotation => {
	const base = {
		type,
		name,
		range,
		priority,
		order,
	};

	if (type === "inlineClass") {
		return { ...base, type, source, class: "c" };
	}
	if (type === "inlineWrap") {
		return { ...base, type, source, render: name };
	}
	if (type === "lineClass") {
		return { ...base, type, class: "line-c" };
	}
	return { ...base, type, render: name };
};

describe("normalizeConfigItems / createAnnotationRegistry", () => {
	it("annotationConfig가 없으면 에러를 던진다", () => {
		expect(() => createAnnotationRegistry(undefined)).toThrowError(
			"[createAnnotationRegistry] ERROR : annotationConfig is required",
		);
	});

	it("기본값(source/scopes)과 priority를 type 그룹별로 부여한다", () => {
		const config: AnnotationConfig = {
			annotations: [
				{ name: "strong", kind: "class", class: "font-bold", source: "mdast", scopes: ["char", "document"] },
				{ name: "emphasis", kind: "class", class: "italic", scopes: ["char"] },
				{ name: "Tooltip", kind: "render", render: "Tooltip", scopes: ["char", "document"] },
				{ name: "diff", kind: "class", class: "diff", scopes: ["line"] },
				{ name: "Callout", kind: "render", render: "Callout", scopes: ["line"] },
			],
		};

		const normalized = normalizeConfigItems(config);
		expect(normalized).toMatchObject([
			{ name: "strong", source: "mdast", scopes: ["char", "document"], priority: 0, kind: "class" },
			{ name: "emphasis", source: "mdx-text", scopes: ["char"], priority: 1, kind: "class" },
			{ name: "Tooltip", source: "mdx-text", scopes: ["char", "document"], priority: 0, kind: "render" },
			{ name: "diff", source: "mdx-text", scopes: ["line"], priority: 0, kind: "class" },
			{ name: "Callout", source: "mdx-text", scopes: ["line"], priority: 0, kind: "render" },
		]);

		const registry = createAnnotationRegistry(config);
		expect(resolveAnnotationTypeByScope(registry.get("strong")!, "char")).toBe("inlineClass");
		expect(resolveAnnotationTypeByScope(registry.get("Tooltip")!, "document")).toBe("inlineWrap");
		expect(resolveAnnotationTypeByScope(registry.get("diff")!, "line")).toBe("lineClass");
		expect(resolveAnnotationTypeByScope(registry.get("Callout")!, "line")).toBe("lineWrap");
	});

	it("중복/잘못된 name은 에러를 던진다", () => {
		expect(() =>
			normalizeConfigItems({
				annotations: [
					{ name: "dup", kind: "class", class: "a" },
					{ name: "dup", kind: "render", render: "X" },
				],
			}),
		).toThrowError('[createAnnotationRegistry] ERROR : duplicated annotation name "dup"');

		expect(() =>
			normalizeConfigItems({
				annotations: [{ name: "1bad", kind: "class", class: "a" }],
			}),
		).toThrowError('[createAnnotationRegistry] ERROR : invalid annotation name "1bad"');
	});
});

describe("fromAnnotationsToEvents", () => {
	it("range start=end인 annotation은 이벤트를 만들지 않는다", () => {
		const events = fromAnnotationsToEvents([
			makeAnnotation({
				type: "inlineWrap",
				name: "noop",
				range: { start: 1, end: 1 },
				order: 0,
			}),
		]);

		expect(events).toEqual([]);
	});

	it("같은 pos에서 close가 open보다 먼저 온다", () => {
		const a = makeAnnotation({
			type: "inlineWrap",
			name: "A",
			range: { start: 0, end: 2 },
			order: 0,
		});
		const b = makeAnnotation({
			type: "inlineWrap",
			name: "B",
			range: { start: 2, end: 4 },
			order: 1,
		});

		const events = fromAnnotationsToEvents([a, b]).map((e) => `${e.kind}@${e.pos}:${e.anno.name}`);
		expect(events).toEqual(["open@0:A", "close@2:A", "open@2:B", "close@4:B"]);
	});

	it("동일 range/pos 충돌 시 order를 마지막 tie-breaker로 사용한다", () => {
		const a = makeAnnotation({
			type: "inlineWrap",
			name: "wrap-0",
			range: { start: 0, end: 2 },
			order: 0,
		});
		const b = makeAnnotation({
			type: "inlineClass",
			name: "class-1",
			range: { start: 0, end: 2 },
			order: 1,
			source: "mdast",
		});

		const opens = fromAnnotationsToEvents([b, a])
			.filter((event) => event.kind === "open")
			.map((event) => event.anno.name);

		expect(opens).toEqual(["wrap-0", "class-1"]);
	});
});
