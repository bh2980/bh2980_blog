import { analyze, serialize, toDocument } from "@bh2980/cms/mdx";
import { buildEditorExtensions } from "@bh2980/cms-admin/editor/extensions";
import { mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor/tiptap-content";
import { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMDX } from "@/components/mdx/mdx-content";

/** 글자색·배경색 저장 형식: `:color[글]{fg fgDark bg bgDark}`(헥스 값, 밝은·어두운 테마 짝). */
const SOURCE = '빨간 :color[경고]{fg="#dc2626" fgDark="#f87171"}와 :color[**강조**]{bg="#fef3c7" bgDark="#453a12"} 글.';

const render = async (element: ReactNode) => {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return await new Response(stream).text();
};

describe("글자색 저장 형식", () => {
	it("분석·직렬화를 지나도 원문이 그대로다", () => {
		const analyzed = analyze(SOURCE);
		expect(analyzed.errors ?? []).toEqual([]);
		const document = toDocument(analyzed);
		const marked = document.content?.[0]?.content?.find((node) => node.marks?.length);
		expect(marked?.marks).toEqual([{ type: "color", attrs: { fg: "#dc2626", fgDark: "#f87171" } }]);
		expect(serialize(document).trimEnd()).toBe(SOURCE);
	});

	it("에디터에 올렸다 저장해도 원문이 그대로다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(SOURCE) });
		const html = editor.getHTML();
		expect(html).toMatch(
			/<span[^>]*data-cms-color[^>]*data-fg[^>]*style="--cms-fg: #dc2626; --cms-fg-dark: #f87171;?"[^>]*>경고<\/span>/,
		);
		expect(tiptapToMdx(editor.getJSON()).trimEnd()).toBe(SOURCE);
		editor.destroy();
	});

	it("에디터에서 색을 모두 빼면 표시가 남지 않는다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(SOURCE) });
		editor.commands.selectAll();
		editor.commands.unsetMark("cmsColor");
		expect(tiptapToMdx(editor.getJSON()).trimEnd()).toBe("빨간 경고와 **강조** 글.");
		editor.destroy();
	});

	it("공개 렌더는 테마별 CSS 변수를 붙이고, 헥스가 아닌 값은 버린다", async () => {
		const { content } = await renderMDX(`${SOURCE}\n\n:color[위험]{fg="red; background:url(x)"}`);
		const html = await render(content);
		expect(html).toContain('class="cms-color" style="--cms-fg:#dc2626;--cms-fg-dark:#f87171" data-fg=""');
		expect(html).toMatch(
			/<span class="cms-color" style="--cms-bg:#fef3c7;--cms-bg-dark:#453a12" data-bg=""><strong>강조<\/strong><\/span>/,
		);
		expect(html).toContain('<span class="cms-color">위험</span>');
		expect(html).not.toContain("url(x)");
	});
});
