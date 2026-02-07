import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { convertInlineAnnoToRenderTag } from "../transformers";

const runCodeHook = (codeEl: Element) => {
	const transformer = convertInlineAnnoToRenderTag();
	const hook = transformer.code;
	expect(hook).toBeTypeOf("function");
	hook?.call({} as never, codeEl);
};

const createInlineElement = (properties: Element["properties"]): Element => ({
	type: "element",
	tagName: "span",
	properties,
	children: [{ type: "text", value: "hello" }],
});

describe("convertInlineAnnoToRenderTag", () => {
	it("data-anno-render를 tagName으로 바꾸고 data-anno-* 속성을 일반 prop으로 변환한다", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-open": "true",
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("Tooltip");
		expect(node.properties.variant).toBe("tip");
		expect(node.properties.open).toBe(true);
		expect(node.properties["data-anno-render"]).toBeUndefined();
		expect(node.properties["data-anno-variant"]).toBeUndefined();
		expect(node.properties["data-anno-open"]).toBeUndefined();
	});

	it("유효하지 않은 render tag면 변환하지 않는다", () => {
		const node = createInlineElement({
			"data-anno-render": "Callout<script>",
			"data-anno-variant": '"tip"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("span");
		expect(node.properties.variant).toBeUndefined();
		expect(node.properties["data-anno-render"]).toBe("Callout<script>");
		expect(node.properties["data-anno-variant"]).toBe('"tip"');
	});

	it("deny 대상 prop은 변환하지 않는다", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-__proto__": '{"polluted":true}',
			"data-anno-dangerouslySetInnerHTML": '{"__html":"<b>x</b>"}',
			"data-anno-children": '"forbidden"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		const props = node.properties as Record<string, unknown>;
		expect(node.tagName).toBe("Tooltip");
		expect(props.variant).toBe("tip");
		expect(props.dangerouslySetInnerHTML).toBeUndefined();
		expect(props.children).toBeUndefined();
		expect(Object.hasOwn(props, "__proto__")).toBe(false);
		expect("polluted" in props).toBe(false);
	});
});
