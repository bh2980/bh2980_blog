import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../../admin-components";
import { buildEditorExtensions } from "../../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../../tiptap-content";
import type { CustomBlockEditorProps } from "../view";

afterEach(cleanup);

function Harness({ source, onReady }: { source: string; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(),
		content: mdxToTiptap(source),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

const mount = async (source: string, wrap: (node: React.ReactNode) => React.ReactNode = (node) => node) => {
	let editor: Editor | null = null;
	render(
		wrap(
			<Harness
				source={source}
				onReady={(ready) => {
					editor = ready;
				}}
			/>,
		),
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await waitFor(() => expect(document.querySelector("[data-cms-custom-block]")).not.toBeNull());
	return editor as unknown as Editor;
};

const NOTICE = ':::notice{level="info"}\n본문\n:::';

/** 사이트가 등록한 편집 컴포넌트(예시): 단계를 버튼으로 바꾼다. */
function NoticeEditor({ values, setValue, content }: CustomBlockEditorProps) {
	return (
		<div>
			<button type="button" contentEditable={false} onClick={() => setValue("level", "warn")}>
				단계: {String(values.level)}
			</button>
			{content}
		</div>
	);
}

describe("사용자 블록 NodeView", () => {
	it("등록한 편집 컴포넌트가 없으면 이름과 속성 입력을 보이고, 고친 값을 저장한다", async () => {
		const editor = await mount(NOTICE);
		expect(screen.getByText("공지")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("단계"), { target: { value: "warn" } });
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain(':::notice{level="warn"}'));
		expect(screen.getByLabelText("제목")).toBeTruthy();
	});

	it("사이트가 등록한 편집 컴포넌트로 그린다", async () => {
		const editor = await mount(NOTICE, (node) => (
			<CmsAdminComponentsProvider components={{ blockEditors: { notice: NoticeEditor } }}>
				{node}
			</CmsAdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("button", { name: "단계: info" }));
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain(':::notice{level="warn"}'));
		expect(tiptapToMdx(editor.getJSON())).toContain("본문");
	});
});
