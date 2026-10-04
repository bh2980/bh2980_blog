import { analyze, serialize, toDocument } from "@bh2980/cms/mdx";
import { prepareSnapshot } from "@bh2980/cms/runtime";
import { buildEditorExtensions, mdxToTiptap, tiptapToMdx } from "@bh2980/cms-admin/editor";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

const MEDIA = "11111111-1111-4111-8111-111111111111";
const SOURCE = `자료를 받는다.\n\n::file{mediaId="${MEDIA}" label="발표 자료"}\n\n끝.`;

// 공개 화면 그리기는 `packages/cms/src/render/__test__/render.test.tsx`가 본다.
describe("첨부 파일 카드 저장 형식(v3)", () => {
	it("분석·직렬화를 지나도 원문이 그대로다", () => {
		const analyzed = analyze(SOURCE);
		expect(analyzed.errors ?? []).toEqual([]);
		expect(serialize(toDocument(analyzed)).trimEnd()).toBe(SOURCE);
	});

	it("에디터에 올렸다 저장해도 그대로이고, 보일 이름을 비우면 label을 쓰지 않는다", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(SOURCE) });
		expect(editor.state.doc.child(1).type.name).toBe("cmsFile");
		expect(tiptapToMdx(editor.getJSON()).trimEnd()).toBe(SOURCE);
		const pos = editor.state.doc.child(0).nodeSize;
		editor.commands.command(({ tr }) => {
			tr.setNodeMarkup(pos, undefined, { mediaId: MEDIA, label: null });
			return true;
		});
		expect(tiptapToMdx(editor.getJSON())).toContain(`::file{mediaId="${MEDIA}"}`);
		editor.destroy();
	});

	it("미디어 참조로 남긴다", async () => {
		const snapshot = await prepareSnapshot({
			collection: "memo",
			slug: "a",
			metadata: { title: "a" },
			mdx: SOURCE,
		} as never);
		expect(snapshot.references).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: "media", targetId: MEDIA })]),
		);
	});
});
