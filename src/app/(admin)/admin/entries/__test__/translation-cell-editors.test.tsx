import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import {
	BlockCellEditor,
	blankLike,
	type CellEditorHandle,
	HeaderCellEditor,
	validateFragment,
} from "../translation-cell-editors";

vi.mock("@/components/ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => (render ? React.cloneElement(render, {}, children ?? render.props.children) : children),
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

const editorIn = () =>
	waitFor(() => {
		const element = document.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror[contenteditable=true]");
		if (!element?.editor) throw new Error("editor not ready");
		return element.editor;
	});

const type = (editor: Editor, html: string) =>
	act(() => {
		editor.commands.setContent(html, { emitUpdate: true });
	});

/** 편집기에 초점을 줬다가 뺀다. */
const leave = (editor: Editor) =>
	act(() => {
		editor.view.dom.focus();
		fireEvent.blur(editor.view.dom);
	});

const block = (props: Partial<React.ComponentProps<typeof BlockCellEditor>> = {}) => {
	const onCommit = vi.fn();
	render(<BlockCellEditor type="paragraph" source="둘째 문단" target={null} editable onCommit={onCommit} {...props} />);
	return { onCommit };
};

describe("BlockCellEditor", () => {
	it("빈 칸은 미번역 안내를 보이고 번역이 있으면 보이지 않는다", async () => {
		block();
		await editorIn();
		expect(screen.getByText("미번역")).toBeDefined();
		cleanup();
		block({ target: "Second" });
		await editorIn();
		expect(screen.queryByText("미번역")).toBeNull();
	});

	it("입력한 뒤 초점을 잃으면 저장한다", async () => {
		const { onCommit } = block();
		const editor = await editorIn();
		type(editor, "<p>하나</p>");
		expect(screen.queryByText("미번역")).toBeNull();
		leave(editor);
		expect(onCommit).toHaveBeenCalledWith("하나");
		// 같은 내용으로 다시 저장하지 않는다.
		leave(editor);
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("바꾸지 않고 초점만 잃으면 저장하지 않는다", async () => {
		const { onCommit } = block({ target: "Second" });
		const editor = await editorIn();
		leave(editor);
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("블록이 둘이 되면 저장하지 않고 오류를 보이며 내보낸 flush도 실패한다", async () => {
		const ref = React.createRef<CellEditorHandle>();
		const { onCommit } = block({ ref });
		const editor = await editorIn();

		type(editor, "<p>하나</p><p>둘</p>");
		leave(editor);
		expect(screen.getByRole("alert").textContent).toBe("블록 하나만");
		expect(onCommit).not.toHaveBeenCalled();
		expect(editor.getText()).toContain("둘");
		let ok = true;
		act(() => {
			ok = ref.current?.flush() ?? true;
		});
		expect(ok).toBe(false);

		// 다음 입력에서 오류가 사라진다.
		type(editor, "<p>하나</p>");
		expect(screen.queryByRole("alert")).toBeNull();
		act(() => {
			ok = ref.current?.flush() ?? false;
		});
		expect(ok).toBe(true);
		expect(onCommit).toHaveBeenCalledWith("하나");
	});

	it("다 지우면 번역을 비운다", async () => {
		const { onCommit } = block({ target: "Second" });
		const editor = await editorIn();
		type(editor, "<p></p>");
		leave(editor);
		expect(onCommit).toHaveBeenCalledWith(null);
	});

	it("Escape는 마지막으로 저장한 값으로 되돌린다", async () => {
		const { onCommit } = block({ target: "Second" });
		const editor = await editorIn();
		const before = editor.getText();
		type(editor, "<p>고침</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Escape" });
		expect(editor.getText()).toBe(before);
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("저장 버튼과 Ctrl+Enter는 바로 저장한다", async () => {
		const { onCommit } = block();
		const editor = await editorIn();
		type(editor, "<p>하나</p>");
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(onCommit).toHaveBeenLastCalledWith("하나");
		type(editor, "<p>둘</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Enter", ctrlKey: true });
		expect(onCommit).toHaveBeenLastCalledWith("둘");
	});

	it("원문 복사는 원문 조각을 바로 저장한다", async () => {
		const { onCommit } = block();
		await editorIn();
		fireEvent.click(screen.getByRole("button", { name: "원문 복사" }));
		expect(onCommit).toHaveBeenCalledWith("둘째 문단");
		await waitFor(() => expect(screen.queryByText("미번역")).toBeNull());
	});

	it("읽기 전용이면 편집기가 잠기고 도구가 없다", async () => {
		block({ editable: false });
		await waitFor(() => expect(screen.getByText("미번역")).toBeDefined());
		expect(document.querySelector(".ProseMirror[contenteditable=true]")).toBeNull();
		expect(screen.queryByRole("button", { name: "원문 복사" })).toBeNull();
		expect(screen.queryByRole("button", { name: "저장" })).toBeNull();
	});
});

describe("HeaderCellEditor", () => {
	const source = JSON.stringify({ title: "알림" });
	const header = (target: string | null = null, editable = true) => {
		const onCommit = vi.fn();
		render(<HeaderCellEditor source={source} target={target} editable={editable} onCommit={onCommit} />);
		return { onCommit, input: screen.getByLabelText<HTMLInputElement>("제목") };
	};

	it("초점을 잃으면 JSON으로 저장한다", () => {
		const { onCommit, input } = header();
		expect(input.placeholder).toBe("미번역");
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.blur(input);
		expect(onCommit).toHaveBeenCalledWith(JSON.stringify({ title: "Notice" }));
	});

	it("Enter로도 저장하고 바꾸지 않으면 저장하지 않는다", () => {
		const { onCommit, input } = header(JSON.stringify({ title: "Notice" }));
		fireEvent.blur(input);
		expect(onCommit).not.toHaveBeenCalled();
		fireEvent.change(input, { target: { value: "Heads up" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onCommit).toHaveBeenCalledWith(JSON.stringify({ title: "Heads up" }));
	});

	it("모두 비우면 번역을 지운다", () => {
		const { onCommit, input } = header(JSON.stringify({ title: "Notice" }));
		fireEvent.change(input, { target: { value: "" } });
		fireEvent.blur(input);
		expect(onCommit).toHaveBeenCalledWith(null);
	});

	it("Escape는 입력을 되돌린다", () => {
		const { onCommit, input } = header(JSON.stringify({ title: "Notice" }));
		fireEvent.change(input, { target: { value: "고침" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("Notice");
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("저장 버튼은 바로 저장하고 원문 복사는 원문을 저장한다", () => {
		const { onCommit, input } = header();
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(onCommit).toHaveBeenLastCalledWith(JSON.stringify({ title: "Notice" }));
		fireEvent.click(screen.getByRole("button", { name: "원문 복사" }));
		expect(onCommit).toHaveBeenLastCalledWith(source);
		expect(input.value).toBe("알림");
	});

	it("읽기 전용이면 입력이 잠기고 도구가 없다", () => {
		const { input } = header(null, false);
		expect(input.readOnly).toBe(true);
		expect(screen.queryByRole("button", { name: "저장" })).toBeNull();
	});
});

describe("validateFragment", () => {
	it("한 블록이고 같은 종류여야 한다", () => {
		expect(validateFragment("안녕", "paragraph")).toBeNull();
		expect(validateFragment("하나\n\n둘", "paragraph")).toBe("블록 하나만");
		expect(validateFragment("## 제목", "paragraph")).toBe("같은 종류의 블록만");
		expect(validateFragment("## 제목", "heading")).toBeNull();
	});

	it("편집기가 덧붙인 빈 문단은 블록으로 세지 않는다", () => {
		const mdx = tiptapToMdx({
			type: "doc",
			content: [
				{ type: "codeBlock", attrs: { language: "js" }, content: [{ type: "text", text: "const a = 1;" }] },
				{ type: "paragraph" },
			],
		}).trim();
		expect(validateFragment(mdx, "codeBlock")).toBeNull();
	});
});

describe("빈칸 번역의 뼈대", () => {
	it("원문과 같은 종류·구조에서 글자와 이미지 설명만 비운다", () => {
		const heading = blankLike(mdxToTiptap("### 소제목"));
		expect(heading.content?.[0]).toMatchObject({ type: "heading", attrs: expect.objectContaining({ level: 3 }) });
		expect(JSON.stringify(heading)).not.toContain("소제목");

		const list = blankLike(mdxToTiptap("- 하나\n- 둘"));
		expect(list.content?.[0]?.content).toHaveLength(2);
		expect(JSON.stringify(list)).not.toContain("하나");

		const image = blankLike(mdxToTiptap('![설명](https://example.com/a.png "캡션")'));
		expect(JSON.stringify(image)).not.toContain("설명");
		expect(JSON.stringify(image)).toContain("https://example.com/a.png");

		const chart = blankLike(mdxToTiptap("```mermaid\ngraph TD\n  A --> B\n```"));
		expect(JSON.stringify(chart)).not.toContain("A --> B");
	});
});
