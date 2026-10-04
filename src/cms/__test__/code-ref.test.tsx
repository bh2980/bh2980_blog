import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

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

// 공개 화면 그리기는 `packages/cms-blocks/src/__test__/public-render.test.tsx`가 본다.
describe("본문–코드 잇기 저장 형식", () => {
	it("분석·직렬화를 지나도 원문이 그대로다", () => {
		const analyzed = analyze(SOURCE);
		expect(analyzed.errors ?? []).toEqual([]);
		const document = toDocument(analyzed);
		const paragraph = document.content?.[0];
		// 코드 연결은 블록 확장(`@monti-cms/blocks`의 `codeRef()`)이다. 문서 mark 이름은 블록 이름이다.
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
});
