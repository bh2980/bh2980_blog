import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMDX } from "../mdx-content";

describe("renderMDX math", () => {
	it("display math만 KaTeX로 렌더링하고 inline math는 일반 텍스트로 남긴다", async () => {
		const { content } = await renderMDX(["Inline $E = mc^2$ math", "", "$$", "a^2+b^2=c^2", "$$"].join("\n"));
		const html = renderToStaticMarkup(content);

		expect(html).toContain("katex");
		expect(html).toContain("katex-display");
		expect(html).toContain("Inline $E = mc^2$ math");
	});

	it("잘못된 수식이 있어도 렌더링이 깨지지 않는다", async () => {
		const { content } = await renderMDX(["$$", "\\frac{1}{", "$$"].join("\n"));

		expect(() => renderToStaticMarkup(content)).not.toThrow();
	});
});
