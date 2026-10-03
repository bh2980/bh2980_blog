import { analyze, serialize, toDocument } from "@bh2980/cms/mdx";
import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderMDX } from "@/components/mdx/mdx-content";

/** 본문–코드 잇기의 저장 형식(v2): 본문 `:code-ref[글자]{to}` ↔ 코드 줄 이름표 `// @line anchor {..} id`. */
const SOURCE = [
	'이 :code-ref[함수가]{to="c1"} 값을 돌려준다.',
	"",
	"```ts",
	'// @line anchor {1-2} id="c1"',
	"function add(a, b) {",
	"  const sum = a + b;",
	"  return sum;",
	"}",
	"```",
].join("\n");

const render = async (element: ReactNode) => {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return await new Response(stream).text();
};

describe("본문–코드 잇기 저장 형식", () => {
	it("분석·직렬화를 지나도 원문이 그대로다", () => {
		const analyzed = analyze(SOURCE);
		expect(analyzed.errors ?? []).toEqual([]);
		const document = toDocument(analyzed);
		const paragraph = document.content?.[0];
		// 코드 연결은 블록 확장(`@bh2980/cms-blocks`의 `codeRef()`)이다. 문서 mark 이름은 블록 이름이다.
		expect(paragraph?.content?.find((node) => node.marks?.length)?.marks).toEqual([
			{ type: "code-ref", attrs: { to: "c1" } },
		]);
		expect(serialize(document).trimEnd()).toBe(SOURCE);
	});

	it("에디터에 올렸다 저장해도 원문이 그대로이고, 코드 줄 이름표는 줄 효과로 읽는다", () => {
		const json = mdxToTiptap(SOURCE);
		const editor = new Editor({ extensions: buildEditorExtensions(), content: json });
		expect(editor.getHTML()).toMatch(/<span data-cms-mark="code-ref"[^>]*data-code-ref="c1"[^>]*>함수가<\/span>/);
		const block = editor.state.doc.child(1);
		expect(block.attrs.lineEffects).toMatchObject([{ name: "anchor", start: 1, end: 3, attrs: { id: "c1" } }]);
		expect(tiptapToMdx(editor.getJSON()).trimEnd()).toBe(SOURCE);
		editor.destroy();
	});

	it("공개 렌더는 연결 글자와 이름표 달린 코드 줄을 낸다", async () => {
		const { content } = await renderMDX(SOURCE);
		const html = await render(content);
		expect(html).toMatch(/data-code-ref="c1"[^>]*>함수가/);
		const anchored = [
			...html.matchAll(/<span class="line[^"]*"[^>]*data-anchor="c1"[^>]*>([\s\S]*?)<\/span><\/span>/g),
		];
		expect(anchored).toHaveLength(2);
		expect(html).toContain('data-anchor="c1"');
	});
});
