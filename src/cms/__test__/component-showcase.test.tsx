import { readFileSync } from "node:fs";
import path from "node:path";
import { analyze } from "@bh2980/cms/mdx";
import { mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MDX_COMPONENTS, MDX_REHYPE_PLUGINS, MDX_REMARK_PLUGINS } from "@/components/mdx/mdx-content";

const source = readFileSync(path.join(__dirname, "fixtures/component-showcase.mdx"), "utf8");

describe("CMS 컴포넌트 샘플 글", () => {
	it("에디터에서 열리고 공개 MDX 렌더러에서 모든 섹션을 표시한다", async () => {
		const analysis = analyze(source);
		expect(analysis.errors).toEqual([]);
		const editorDocument = mdxToTiptap(source);
		expect(editorDocument.content?.length).toBeGreaterThan(30);
		expect(tiptapToMdx(editorDocument).trim()).toBe(source.trim());

		// 공개 코드 블록의 pre는 async 컴포넌트라 정적 렌더 검사에서만 동기 대체한다.
		const { content } = await compileMDX({
			source,
			options: { mdxOptions: { remarkPlugins: MDX_REMARK_PLUGINS(), rehypePlugins: MDX_REHYPE_PLUGINS } },
			components: {
				...MDX_COMPONENTS,
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
