import { readFileSync } from "node:fs";
import path from "node:path";
import { renderMdx } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMdxComponents } from "@/components/mdx/mdx-content";

// 에디터 왕복·검사·라이브러리 기본 모양은 `packages/cms-blocks/src/__test__/component-showcase.test.tsx`가 본다.
const source = readFileSync(path.join(__dirname, "fixtures/component-showcase.mdx"), "utf8");

describe("CMS 컴포넌트 샘플 글(블로그 컴포넌트)", () => {
	it("블로그 공개 컴포넌트가 모든 섹션을 표시한다", async () => {
		// 공개 코드 블록의 pre는 async 컴포넌트라 정적 렌더 검사에서만 동기 대체한다.
		const { content } = await renderMdx(source, {
			components: {
				...createMdxComponents(),
				pre: ({ children }: { children?: ReactNode }) => <div data-test-code-block>{children}</div>,
			},
		});
		const html = renderToStaticMarkup(content);
		for (const text of [
			"직접 지정한 팁 제목",
			"처음부터 열린 접기",
			"가운데 정렬 문단",
			"블로그 렌더링 흐름을 보여 주는 스크린샷",
			"자르기와 90도 회전을 적용한 이미지",
			"글자 단위 접기",
		]) {
			expect(html).toContain(text);
		}
		expect(html).toContain("recharts-responsive-container");
		expect(html).not.toContain("차트 문법 오류");
		expect(html).toContain("katex-display");
		expect(html).toContain("<table");
		expect(html).toContain("<svg");
	});
});
