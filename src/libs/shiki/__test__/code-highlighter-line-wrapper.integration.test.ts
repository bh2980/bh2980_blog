import type { Element } from "hast";
import { describe, expect, it } from "vitest";
import { highlight } from "../code-highligher";

const findCode = (pre: Element) =>
	pre.children.find((child) => child.type === "element" && child.tagName === "code") as Element | undefined;

describe("highlight line wrapper integration", () => {
	it("injects line wrapper into highlighted hast", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				lineWrappers: [{ type: "lineWrap", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);
		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		expect(pre).toBeDefined();
		const code = pre ? findCode(pre) : undefined;
		expect(code).toBeDefined();

		const wrapper = code?.children.find((node) => node.type === "element" && node.tagName === "Callout");
		expect(wrapper).toBeDefined();
	});
});
