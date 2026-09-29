import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignUnits, flattenUnits, type StoredUnit } from "@/cms/core/translation/units";
import { analyze, toDocument } from "@/cms/mdx";
import { TranslationPanel, type TranslationPanelHandle } from "../translation-panel";

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

const SOURCE = ["첫 문단", ':::callout{variant="note" title="알림"}\n안쪽 문단\n:::', "셋째 문단"].join("\n\n");
// 줄: 0 첫 문단, 1 콜아웃 제목, 2 안쪽 문단, 3 셋째 문단

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
	props: Partial<React.ComponentProps<typeof TranslationPanel>> = {},
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
		<TranslationPanel
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

describe("TranslationPanel", () => {
	it("원문과 번역 편집기, 위치를 보인다", async () => {
		setup(["translated", "translated", "translated", "untranslated"], 3);
		expect(screen.getByText("4/4")).toBeDefined();
		expect(screen.getByText("KO 원문")).toBeDefined();
		expect(screen.getByText("EN")).toBeDefined();
		await editorIn();
		await waitFor(() => expect(document.body.textContent).toContain("셋째 문단"));
		expect(screen.getByText("미번역")).toBeDefined();
	});

	it("상자 안 블록은 상자 이름과 위치를 보이고 머리 줄은 제목 입력을 보인다", async () => {
		setup(["translated", "translated", "translated", "translated"], 2);
		expect(screen.getByText("콜아웃 안 · 3/4")).toBeDefined();
		cleanup();
		setup(["translated", "untranslated", "translated", "translated"], 1);
		expect(screen.getByText("콜아웃 제목 · 2/4")).toBeDefined();
		expect(screen.getByLabelText<HTMLInputElement>("제목").placeholder).toBe("미번역");
	});

	it("저장은 번역을 그 줄에 넘긴다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"], 3);
		const editor = await editorIn();
		type(editor, "<p>Third</p>");
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(onChangeTarget).toHaveBeenCalledWith(3, "Third");
	});

	it("이전·다음·닫기 버튼은 알리고 양 끝에서는 막힌다", () => {
		const { onPrev, onNext, onClose } = setup(["translated", "translated", "translated", "translated"], 0);
		expect(screen.getByRole("button", { name: "이전 블록" }).hasAttribute("disabled")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "다음 블록" }));
		fireEvent.click(screen.getByRole("button", { name: "닫기" }));
		expect(onNext).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
		expect(onPrev).not.toHaveBeenCalled();
	});

	it("flush는 고치던 내용을 저장하고 잘못된 내용이면 실패한다", async () => {
		const ref = React.createRef<TranslationPanelHandle>();
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"], 3, { ref });
		const editor = await editorIn();

		type(editor, "<p>하나</p><p>둘</p>");
		let ok = true;
		act(() => {
			ok = ref.current?.flush() ?? true;
		});
		expect(ok).toBe(false);
		expect(screen.getByRole("alert").textContent).toBe("블록 하나만");
		expect(onChangeTarget).not.toHaveBeenCalled();

		type(editor, "<p>하나</p>");
		act(() => {
			ok = ref.current?.flush() ?? false;
		});
		expect(ok).toBe(true);
		expect(onChangeTarget).toHaveBeenCalledWith(3, "하나");
	});

	it("원문 변경됨은 비교와 변경 무시를 보인다", async () => {
		const { onIgnoreChange } = setup(["translated", "translated", "translated", "changed"], 3);
		expect(screen.getByText("원문 변경됨")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "비교" }));
		expect(screen.getByText("이전")).toBeDefined();
		expect(screen.getByText("지금")).toBeDefined();
		await waitFor(() => expect(document.body.textContent).toContain("(옛 원문)"));
		fireEvent.click(screen.getByRole("button", { name: "변경 무시" }));
		expect(onIgnoreChange).toHaveBeenCalledWith(3);
	});

	it("읽기 전용이면 번역 편집기가 잠기고 동작 버튼이 없다", async () => {
		setup(["translated", "translated", "translated", "changed"], 3, { editable: false });
		expect(screen.getByRole("button", { name: "비교" })).toBeDefined();
		expect(screen.queryByRole("button", { name: "저장" })).toBeNull();
		expect(screen.queryByRole("button", { name: "원문 복사" })).toBeNull();
		expect(screen.queryByRole("button", { name: "변경 무시" })).toBeNull();
		await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());
		expect(document.querySelector(".ProseMirror[contenteditable=true]")).toBeNull();
	});
});
