import { analyze, serialize, toDocument } from "@bh2980/cms/mdx";
import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { colorMarkExtension } from "@bh2980/cms-blocks/color/admin";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

/** 글자색·배경색 저장 형식: `:color[글]{fg fgDark bg bgDark}`(헥스 값, 밝은·어두운 테마 짝). */
const SOURCE = '빨간 :color[경고]{fg="#dc2626" fgDark="#f87171"}와 :color[**강조**]{bg="#fef3c7" bgDark="#453a12"} 글.';

// 공개 화면 그리기는 `packages/cms-blocks/src/__test__/public-render.test.tsx`가 본다.
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
		// 글자색은 블록 확장(`@bh2980/cms-blocks`의 `color()`)이고 편집기 모양도 확장이 준다.
		const editor = new Editor({
			extensions: buildEditorExtensions({ color: colorMarkExtension }),
			content: mdxToTiptap(SOURCE),
		});
		const html = editor.getHTML();
		expect(html).toMatch(
			/<span[^>]*data-cms-mark="color"[^>]*data-fg[^>]*style="--cms-fg: #dc2626; --cms-fg-dark: #f87171;?"[^>]*>경고<\/span>/,
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
});
