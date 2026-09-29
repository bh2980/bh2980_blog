import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignUnits, flattenUnits, type StoredUnit } from "@/cms/core/translation/units";
import { analyze, toDocument } from "@/cms/mdx";
import { TranslationBand, type TranslationBandHandle } from "../translation-band";

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

// jsdom에는 없는 좌표 API. Shift+Enter(줄바꿈)가 커서를 화면에 맞출 때 쓴다.
if (typeof Range.prototype.getClientRects !== "function") {
	Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
	Range.prototype.getBoundingClientRect = () => new DOMRect();
}

afterEach(cleanup);

const SOURCE = [
	"첫 문단",
	':::callout{variant="note" title="알림"}\n안쪽 문단\n:::',
	"## 소제목",
	"```js\nconst a = 1;\n```",
].join("\n\n");
// 줄: 0 첫 문단, 1 콜아웃 제목, 2 안쪽 문단, 3 소제목, 4 코드

const rowsFor = (statuses: ("translated" | "untranslated" | "changed")[]) => {
	const units = flattenUnits(toDocument(analyze(SOURCE)));
	const stored: StoredUnit[] = units.map((unit, index) => {
		const status = statuses[index] ?? "translated";
		if (status === "untranslated") return { key: unit.key, source: unit.source, target: null };
		const source = status === "changed" ? `${unit.source} (옛 원문)` : unit.source;
		return { key: unit.key, source, target: unit.kind === "header" ? '{"title":"Notice"}' : `EN ${unit.source}` };
	});
	return alignUnits(units, stored);
};

const setup = (
	statuses: Parameters<typeof rowsFor>[0],
	index: number,
	props: Partial<React.ComponentProps<typeof TranslationBand>> = {},
) => {
	const rows = rowsFor(statuses);
	const handlers = {
		onChangeTarget: vi.fn(),
		onIgnoreChange: vi.fn(),
		onPrev: vi.fn(),
		onNext: vi.fn(),
		onClose: vi.fn(),
	};
	const row = rows[index];
	if (!row) throw new Error("no row");
	render(
		<TranslationBand
			row={row}
			index={index}
			total={rows.length}
			editable
			sourceLocale="ko"
			targetLocale="en"
			{...handlers}
			{...props}
		/>,
	);
	return { rows, ...handlers };
};

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

describe("TranslationBand", () => {
	it("원문과 번역 편집기, 위치를 보인다", async () => {
		setup(["translated", "translated", "translated", "translated", "untranslated"], 0);
		expect(screen.getByText("1/5")).toBeDefined();
		expect(screen.getByText("KO 원문")).toBeDefined();
		expect(screen.getByText("EN")).toBeDefined();
		await editorIn();
		await waitFor(() => expect(document.body.textContent).toContain("첫 문단"));
	});

	it("상자 안 블록은 상자 이름을, 머리 줄은 제목 입력을 보인다", () => {
		setup(["translated", "translated", "translated", "translated", "translated"], 2);
		expect(screen.getByText("콜아웃 안 · 3/5")).toBeDefined();
		cleanup();
		setup(["translated", "untranslated", "translated", "translated", "translated"], 1);
		expect(screen.getByText("콜아웃 제목 · 2/5")).toBeDefined();
		expect(screen.getByLabelText<HTMLInputElement>("제목").placeholder).toBe("미번역");
	});

	it("저장 버튼은 번역을 그 줄에 넘기고 원문 복사는 원문을 넣는다", async () => {
		const { rows, onChangeTarget } = setup(["translated", "translated", "translated", "translated", "translated"], 0);
		const editor = await editorIn();
		type(editor, "<p>First</p>");
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(onChangeTarget).toHaveBeenCalledWith(0, "First");
		fireEvent.click(screen.getByRole("button", { name: "원문 복사" }));
		expect(onChangeTarget).toHaveBeenLastCalledWith(0, rows[0]?.unit.source);
	});

	it("Cmd/Ctrl+Enter는 저장하고 다음으로 간다", async () => {
		const { onChangeTarget, onNext } = setup(
			["translated", "translated", "translated", "translated", "untranslated"],
			4,
		);
		const editor = await editorIn();
		type(editor, "<pre><code>const b = 2;</code></pre>");
		fireEvent.keyDown(editor.view.dom, { key: "Enter", ctrlKey: true });
		expect(onChangeTarget).toHaveBeenCalledTimes(1);
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("문단의 Enter는 저장하고 다음으로 가며 Shift+Enter는 그러지 않는다", async () => {
		const { onChangeTarget, onNext } = setup(["translated", "translated", "translated", "translated", "translated"], 0);
		const editor = await editorIn();
		type(editor, "<p>Hello</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Enter", shiftKey: true });
		expect(onNext).not.toHaveBeenCalled();
		expect(onChangeTarget).not.toHaveBeenCalled();
		// 줄바꿈이 들어간 문단도 저장한다.
		fireEvent.keyDown(editor.view.dom, { key: "Enter" });
		expect(onChangeTarget).toHaveBeenCalledTimes(1);
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("코드 블록의 Enter는 줄바꿈이다", async () => {
		const { onNext } = setup(["translated", "translated", "translated", "translated", "translated"], 4);
		const editor = await editorIn();
		fireEvent.keyDown(editor.view.dom, { key: "Enter" });
		expect(onNext).not.toHaveBeenCalled();
	});

	it("Esc는 고치던 내용을 버리고 닫는다", async () => {
		const { onChangeTarget, onClose } = setup(
			["translated", "translated", "translated", "translated", "translated"],
			0,
		);
		const editor = await editorIn();
		type(editor, "<p>버릴 글</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onChangeTarget).not.toHaveBeenCalled();
		expect(editor.getText()).toContain("첫 문단");
	});

	it("잘못된 내용이면 저장하지 않고 다음으로 가지 않는다", async () => {
		const ref = React.createRef<TranslationBandHandle>();
		const { onChangeTarget, onNext } = setup(
			["translated", "translated", "translated", "translated", "translated"],
			0,
			{ ref },
		);
		const editor = await editorIn();
		type(editor, "<p>하나</p><p>둘</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Enter", metaKey: true });
		expect(screen.getByRole("alert").textContent).toBe("블록 하나만");
		expect(onChangeTarget).not.toHaveBeenCalled();
		expect(onNext).not.toHaveBeenCalled();
		let ok = true;
		act(() => {
			ok = ref.current?.flush() ?? true;
		});
		expect(ok).toBe(false);
	});

	it("머리 줄 입력의 Enter는 저장하고 다음으로, Esc는 버리고 닫는다", () => {
		const { onChangeTarget, onNext, onClose } = setup(
			["translated", "untranslated", "translated", "translated", "translated"],
			1,
		);
		const input = screen.getByLabelText("제목");
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onChangeTarget).toHaveBeenCalledWith(1, JSON.stringify({ title: "Notice" }));
		expect(onNext).toHaveBeenCalledTimes(1);
		fireEvent.change(input, { target: { value: "다른 것" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onChangeTarget).toHaveBeenCalledTimes(1);
	});

	it("이전·다음·닫기 버튼은 알리고 양 끝에서는 막힌다", () => {
		const { onPrev, onNext, onClose } = setup(
			["translated", "translated", "translated", "translated", "translated"],
			0,
		);
		expect(screen.getByRole("button", { name: "이전 블록" }).hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "다음 블록" }));
		fireEvent.click(screen.getByRole("button", { name: "닫기" }));
		expect(onNext).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
		expect(onPrev).not.toHaveBeenCalled();
	});

	it("원문 변경됨은 비교와 변경 무시를 보이고 비교는 이전·지금을 왼쪽에 쌓는다", async () => {
		const { onIgnoreChange } = setup(["translated", "translated", "translated", "changed", "translated"], 3);
		expect(screen.getByText("원문 변경됨")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "비교" }));
		expect(screen.getByText("이전")).toBeDefined();
		expect(screen.getByText("지금")).toBeDefined();
		await waitFor(() => expect(document.body.textContent).toContain("(옛 원문)"));
		fireEvent.click(screen.getByRole("button", { name: "변경 무시" }));
		expect(onIgnoreChange).toHaveBeenCalledWith(3);
	});

	it("읽기 전용이면 번역 편집기가 잠기고 동작 버튼이 없다", async () => {
		setup(["translated", "translated", "translated", "changed", "translated"], 3, { editable: false });
		expect(screen.getByRole("button", { name: "비교" })).toBeDefined();
		for (const name of ["저장", "원문 복사", "변경 무시"]) {
			expect(screen.queryByRole("button", { name })).toBeNull();
		}
		await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());
		expect(document.querySelector(".ProseMirror[contenteditable=true]")).toBeNull();
	});
});
