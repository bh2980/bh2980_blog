import { describe, expect, it } from "vitest";
import { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "../render-policy";

describe("render-policy", () => {
	it("config에서 inline/line wrapper render tag를 수집한다", () => {
		const tags = createAllowedRenderTagsFromConfig({
			inlineWrap: [{ name: "Tooltip", source: "mdx-text", render: "Tooltip" }],
			lineWrap: [{ name: "Callout", source: "mdx-flow", render: "Callout" }],
		});

		expect(tags).toEqual(["Tooltip", "Callout"]);
	});

	it("위험한 tag는 allowlist에서 제외한다", () => {
		expect(isSafeRenderTag("script")).toBe(false);
		expect(isSafeRenderTag("iframe")).toBe(false);
		expect(isSafeRenderTag("Tooltip")).toBe(true);

		const tags = createAllowedRenderTagsFromConfig({
			inlineWrap: [{ name: "Danger", source: "mdx-text", render: "script" }],
			lineWrap: [{ name: "Tooltip", source: "mdx-flow", render: "Tooltip" }],
		});

		expect(tags).toEqual(["Tooltip"]);
	});
});
