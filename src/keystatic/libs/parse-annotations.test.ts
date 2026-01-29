import { describe, expect, it } from "vitest";
import type { AnnotationEvent, LineAnnotation } from "./parse-annotations";
import { buildEvents } from "./parse-annotations";
import { AnnotationType } from "./serialize-annotations";

const proj = (e: AnnotationEvent) =>
	`${e.pos}:${e.kind}:${e.anno.type}:${e.anno.priority}:${e.anno.name}{${e.anno.range.start}-${e.anno.range.end}}`;

const projAll = (events: AnnotationEvent[]) => events.map(proj);

const anno = (partial: Omit<LineAnnotation, "priority"> & { priority?: number }): LineAnnotation => ({
	priority: 0,
	...partial,
});

describe("buildEvents", () => {
	it("빈 입력은 빈 이벤트를 반환한다", () => {
		expect(buildEvents([])).toEqual([]);
	});

	it("단일 annotation은 open/close 이벤트를 생성한다", () => {
		const annotations = [anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 2, end: 5 } })];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual(["2:open:3:0:Tooltip{2-5}", "5:close:3:0:Tooltip{2-5}"]);
	});

	it("같은 pos에서는 close가 open보다 먼저 온다", () => {
		const annotations = [
			anno({ type: AnnotationType.MARK, name: "u", range: { start: 0, end: 3 } }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 3, end: 6 } }),
		];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual([
			"0:open:3:0:u{0-3}",
			"3:close:3:0:u{0-3}",
			"3:open:3:0:Tooltip{3-6}",
			"6:close:3:0:Tooltip{3-6}",
		]);
	});

	it("같은 start(open pos)에서는 end가 큰 것이 먼저 open된다", () => {
		const annotations = [
			anno({ type: AnnotationType.MARK, name: "u", range: { start: 1, end: 7 } }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 1, end: 4 } }),
		];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual([
			"1:open:3:0:u{1-7}",
			"1:open:3:0:Tooltip{1-4}",
			"4:close:3:0:Tooltip{1-4}",
			"7:close:3:0:u{1-7}",
		]);
	});

	it("같은 end(close pos)에서는 start가 큰 것이 먼저 close된다", () => {
		const annotations = [
			anno({ type: AnnotationType.MARK, name: "u", range: { start: 1, end: 7 } }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 3, end: 7 } }),
		];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual([
			"1:open:3:0:u{1-7}",
			"3:open:3:0:Tooltip{3-7}",
			"7:close:3:0:Tooltip{3-7}",
			"7:close:3:0:u{1-7}",
		]);
	});

	it("동률일 때 type → priority 순으로 tie-break한다", () => {
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "strong", range: { start: 1, end: 4 }, priority: 5 }),
			anno({ type: AnnotationType.MARK, name: "Tooltip", range: { start: 1, end: 4 }, priority: 0 }),
		];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual([
			"1:open:1:5:strong{1-4}",
			"1:open:3:0:Tooltip{1-4}",
			"4:close:1:5:strong{1-4}",
			"4:close:3:0:Tooltip{1-4}",
		]);
	});

	it("같은 type이면 priority가 작은 것이 먼저 온다", () => {
		const annotations = [
			anno({ type: AnnotationType.DECORATION, name: "a", range: { start: 2, end: 5 }, priority: 2 }),
			anno({ type: AnnotationType.DECORATION, name: "b", range: { start: 2, end: 5 }, priority: 0 }),
		];

		const events = buildEvents(annotations);
		expect(projAll(events)).toEqual([
			"2:open:1:0:b{2-5}",
			"2:open:1:2:a{2-5}",
			"5:close:1:0:b{2-5}",
			"5:close:1:2:a{2-5}",
		]);
	});

	it("빈 구간은 이벤트를 만들지 않는다", () => {
		const annotations = [anno({ type: AnnotationType.DECORATION, name: "strong", range: { start: 2, end: 2 } })];

		const events = buildEvents(annotations);
		expect(events).toEqual([]);
	});
});
