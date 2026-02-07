import { describe, expect, it } from "vitest";
import { ANNOTATION_TYPE_DEFINITION } from "../constants";
import { __testable__ } from "../libs";
import type { Annotation, Range } from "../types";

type AnnotationTypeKey = keyof typeof ANNOTATION_TYPE_DEFINITION;
const { fromAnnotationsToEvents } = __testable__;

const makeAnnotation = <T extends AnnotationTypeKey>({
	type,
	name,
	range,
	order,
	priority = 0,
	source = "mdx-text",
}: {
	type: T;
	name: string;
	range: Range;
	order: number;
	priority?: number;
	source?: Annotation["source"];
}): Extract<Annotation, { type: T }> => {
	const def = ANNOTATION_TYPE_DEFINITION[type];

	return {
		type,
		typeId: def.typeId,
		tag: def.tag,
		source,
		name,
		range,
		priority,
		order,
	} as Extract<Annotation, { type: T }>;
};

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

	it("open 이벤트는 같은 pos에서 더 긴 range(end가 큰) 것이 먼저 온다", () => {
		const outer = makeAnnotation({
			type: "inlineWrap",
			name: "outer",
			range: { start: 0, end: 5 },
			order: 0,
		});
		const inner = makeAnnotation({
			type: "inlineWrap",
			name: "inner",
			range: { start: 0, end: 3 },
			order: 1,
		});

		const opens = fromAnnotationsToEvents([inner, outer])
			.filter((e) => e.kind === "open")
			.map((e) => e.anno.name);

		expect(opens).toEqual(["outer", "inner"]);
	});

	it("close 이벤트는 같은 pos에서 더 큰 start가 먼저 온다", () => {
		const outer = makeAnnotation({
			type: "inlineWrap",
			name: "outer",
			range: { start: 0, end: 5 },
			order: 0,
		});
		const inner = makeAnnotation({
			type: "inlineWrap",
			name: "inner",
			range: { start: 2, end: 5 },
			order: 1,
		});

		const closes = fromAnnotationsToEvents([outer, inner])
			.filter((e) => e.kind === "close")
			.map((e) => e.anno.name);

		expect(closes).toEqual(["inner", "outer"]);
	});

	it("typeId가 order보다 우선되고, order가 마지막 tie-breaker로 동작한다", () => {
		const classAnno = makeAnnotation({
			type: "inlineClass",
			name: "class",
			range: { start: 0, end: 2 },
			order: 0,
			source: "mdast",
		});
		const wrapOrder0 = makeAnnotation({
			type: "inlineWrap",
			name: "wrap-0",
			range: { start: 0, end: 2 },
			order: 0,
		});
		const wrapOrder1 = makeAnnotation({
			type: "inlineWrap",
			name: "wrap-1",
			range: { start: 0, end: 2 },
			order: 1,
		});

		const opens = fromAnnotationsToEvents([wrapOrder1, wrapOrder0, classAnno])
			.filter((e) => e.kind === "open" && e.pos === 0)
			.map((e) => e.anno.name);

		expect(opens).toEqual(["class", "wrap-0", "wrap-1"]);
	});
});
