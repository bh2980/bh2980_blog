import type { Element } from "hast";
import type { ShikiTransformer } from "shiki";
import { describe, expect, it } from "vitest";
import * as transformerModule from "../transformers";

type LineDecorationPayload = {
	type: "lineClass";
	name: string;
	range: { start: number; end: number };
	class: string;
};

const addLineDecorations = (
	transformerModule as unknown as {
		addLineDecorations?: (lineDecorations: LineDecorationPayload[]) => ShikiTransformer;
	}
).addLineDecorations;

const createLineElement = (): Element => ({
	type: "element",
	tagName: "span",
	properties: { className: ["line"] },
	children: [],
});

const runLineHook = (transformer: ShikiTransformer, lineElement: Element, lineNumber: number) => {
	const hook = transformer.line;
	expect(hook).toBeTypeOf("function");
	hook?.call({} as never, lineElement, lineNumber);
};

const createTransformer = (lineDecorations: LineDecorationPayload[]) => {
	if (typeof addLineDecorations !== "function") {
		throw new Error("addLineDecorations is not implemented");
	}

	return addLineDecorations(lineDecorations);
};

describe("transformers.line addLineDecorations", () => {
	it("line decoration transformer를 제공한다", () => {
		expect(addLineDecorations).toBeTypeOf("function");
	});

	it("range에 포함된 line(1-based 입력)에 class를 추가한다", () => {
		const transformer = createTransformer([
			{
				type: "lineClass",
				name: "diff",
				range: { start: 0, end: 2 },
				class: "diff",
			},
		]);

		const line1 = createLineElement();
		const line2 = createLineElement();
		const line3 = createLineElement();

		runLineHook(transformer, line1, 1);
		runLineHook(transformer, line2, 2);
		runLineHook(transformer, line3, 3);

		expect(line1.properties.className).toEqual(expect.arrayContaining(["line", "diff"]));
		expect(line2.properties.className).toEqual(expect.arrayContaining(["line", "diff"]));
		expect(line3.properties.className).toEqual(["line"]);
	});

	it("여러 line decoration이 겹치면 class를 병합한다", () => {
		const transformer = createTransformer([
			{
				type: "lineClass",
				name: "diff",
				range: { start: 0, end: 3 },
				class: "diff",
			},
			{
				type: "lineClass",
				name: "focus",
				range: { start: 1, end: 2 },
				class: "focus",
			},
		]);

		const line2 = createLineElement();
		runLineHook(transformer, line2, 2);

		expect(line2.properties.className).toEqual(expect.arrayContaining(["line", "diff", "focus"]));
	});

	it("유효하지 않은 range(start >= end)는 무시한다", () => {
		const transformer = createTransformer([
			{
				type: "lineClass",
				name: "invalid",
				range: { start: 1, end: 1 },
				class: "invalid",
			},
		]);

		const line2 = createLineElement();
		runLineHook(transformer, line2, 2);

		expect(line2.properties.className).toEqual(["line"]);
	});
});
