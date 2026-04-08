import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMDX } from "../mdx-content";

describe("renderMDX chart", () => {
	it("chart code fence를 Chart 컴포넌트로 렌더링한다", async () => {
		const { content } = await renderMDX(
			["```chart", "chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | views", "Jan | 1200", "```"].join(
				"\n",
			),
		);
		const html = renderToStaticMarkup(content);

		expect(html).toContain("recharts-responsive-container");
		expect(html).toContain("--color-views: var(--chart-1);");
	});

	it("잘못된 차트 DSL이어도 오류 카드로 렌더링한다", async () => {
		const { content } = await renderMDX(
			["```chart", "chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | views", "Jan | nope", "```"].join(
				"\n",
			),
		);
		const html = renderToStaticMarkup(content);

		expect(html).toContain("차트 문법 오류");
		expect(html).toContain("숫자 필드");
	});
});
