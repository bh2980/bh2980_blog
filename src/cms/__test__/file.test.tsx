import { prepareSnapshot } from "@bh2980/cms/core/snapshot";
import { analyze, serialize, toDocument } from "@bh2980/cms/mdx";
import { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import { renderMDX } from "@/components/mdx/mdx-content";

const MEDIA = "11111111-1111-4111-8111-111111111111";
const SOURCE = `자료를 받는다.\n\n::file{mediaId="${MEDIA}" label="발표 자료"}\n\n끝.`;

const render = async (element: ReactNode) => {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return await new Response(stream).text();
};

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

	it("공개 화면은 이름·형식·크기와 내려받기 링크를 낸다", async () => {
		const { content } = await renderMDX(SOURCE, {
			imageResolver: () => ({
				url: "https://cdn.example/a.pdf",
				file: { filename: "deck.pdf", byteSize: 2_516_582, mimeType: "application/pdf" },
			}),
		});
		const html = await render(content);
		expect(html).toContain("발표 자료");
		expect(html).toContain("PDF · 2.4MB");
		expect(html).toMatch(/<a href="https:\/\/cdn\.example\/a\.pdf" download="deck\.pdf"/);
	});
});
