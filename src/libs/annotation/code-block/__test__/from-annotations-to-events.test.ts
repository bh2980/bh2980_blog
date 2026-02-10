import { describe, expect, it } from "vitest";
import { __testable__ } from "../libs";
import type { CodeBlockAnnotation, Range } from "../types";

const { fromAnnotationsToEvents } = __testable__;

const makeAnnotation = ({
	scope,
	name,
	range,
	order,
	priority = 0,
	source = "mdx-text",
	mode,
}: {
	scope: CodeBlockAnnotation["scope"];
	name: string;
	range: Range;
	order: number;
	priority?: number;
	source?: "mdast" | "mdx-text";
	mode?: "class" | "render";
}): CodeBlockAnnotation => {
	const resolvedMode = mode ?? (source === "mdast" ? "class" : "render");
	if (scope === "line") {
		const base = { scope, name, range, priority, order };
		return resolvedMode === "class" ? { ...base, class: "line-c" } : { ...base, render: name };
	}

	const base = { scope, name, range, priority, order, source };
	return resolvedMode === "class" ? { ...base, class: "c" } : { ...base, render: name };
};

describe("fromAnnotationsToEvents", () => {
	it("range start=end인 annotation은 이벤트를 만들지 않는다", () => {
		const events = fromAnnotationsToEvents([
			makeAnnotation({
				scope: "char",
				name: "noop",
				range: { start: 1, end: 1 },
				order: 0,
			}),
		]);

		expect(events).toEqual([]);
	});

	it("같은 pos에서 close가 open보다 먼저 온다", () => {
		const a = makeAnnotation({
			scope: "char",
			name: "A",
			range: { start: 0, end: 2 },
			order: 0,
		});
		const b = makeAnnotation({
			scope: "char",
			name: "B",
			range: { start: 2, end: 4 },
			order: 1,
		});

		const events = fromAnnotationsToEvents([a, b]).map((e) => `${e.kind}@${e.pos}:${e.anno.name}`);

		expect(events).toEqual(["open@0:A", "close@2:A", "open@2:B", "close@4:B"]);
	});

	it("open 이벤트는 같은 pos에서 order 오름차순으로 정렬된다", () => {
		const outer = makeAnnotation({
			scope: "char",
			name: "outer",
			range: { start: 0, end: 5 },
			order: 2,
		});
		const inner = makeAnnotation({
			scope: "char",
			name: "inner",
			range: { start: 0, end: 3 },
			order: 0,
		});

		const opens = fromAnnotationsToEvents([inner, outer])
			.filter((e) => e.kind === "open")
			.map((e) => e.anno.name);

		expect(opens).toEqual(["inner", "outer"]);
	});

	it("close 이벤트는 같은 pos에서 order 내림차순으로 정렬된다", () => {
		const outer = makeAnnotation({
			scope: "char",
			name: "outer",
			range: { start: 0, end: 5 },
			order: 1,
		});
		const inner = makeAnnotation({
			scope: "char",
			name: "inner",
			range: { start: 2, end: 5 },
			order: 0,
		});

		const closes = fromAnnotationsToEvents([outer, inner])
			.filter((e) => e.kind === "close")
			.map((e) => e.anno.name);

		expect(closes).toEqual(["outer", "inner"]);
	});

	it("동일 pos/range 충돌 시 order가 마지막 tie-breaker로 동작한다", () => {
		const classAnno = makeAnnotation({
			scope: "char",
			name: "class",
			range: { start: 0, end: 2 },
			order: 2,
			source: "mdast",
		});
		const wrapOrder0 = makeAnnotation({
			scope: "char",
			name: "wrap-0",
			range: { start: 0, end: 2 },
			order: 0,
		});
		const wrapOrder1 = makeAnnotation({
			scope: "char",
			name: "wrap-1",
			range: { start: 0, end: 2 },
			order: 1,
		});

		const opens = fromAnnotationsToEvents([wrapOrder1, wrapOrder0, classAnno])
			.filter((e) => e.kind === "open" && e.pos === 0)
			.map((e) => e.anno.name);

		expect(opens).toEqual(["wrap-0", "wrap-1", "class"]);
	});
});
