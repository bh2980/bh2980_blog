import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignUnits, flattenUnits, type StoredUnit } from "@/cms/core/translation/units";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import { analyze, toDocument } from "@/cms/mdx";
import { blankLike, TranslationPairView, validateFragment } from "../translation-pair-view";

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

const SOURCE = [
	"첫 문단",
	':::callout{variant="note" title="알림"}\n안쪽 문단\n:::',
	"둘째 문단",
	"셋째 문단",
	"넷째 문단",
].join("\n\n");

/** 단위별 상태를 지정해 줄을 만든다. */
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
	props: Partial<Parameters<typeof TranslationPairView>[0]> = {},
) => {
	const onChangeTarget = vi.fn();
	const onIgnoreChange = vi.fn();
	const rows = rowsFor(statuses);
	render(
		<TranslationPairView
			rows={rows}
			sourceLocale="ko"
			targetLocale="en"
			editable
			onChangeTarget={onChangeTarget}
			onIgnoreChange={onIgnoreChange}
			{...props}
		/>,
	);
	return { rows, onChangeTarget, onIgnoreChange };
};

const rowAt = (container: HTMLElement, index: number) =>
	container.querySelector<HTMLElement>(`[data-row-index="${index}"]`) as HTMLElement;

/** 줄 안에서 편집 가능한 Tiptap 인스턴스를 기다려 돌려준다. */
const editorIn = (row: HTMLElement, editable = true) =>
	waitFor(() => {
		const selector = `.ProseMirror[contenteditable=${editable}]`;
		const element = row.querySelector<HTMLElement & { editor?: Editor }>(selector);
		if (!element?.editor) throw new Error("editor not ready");
		return element.editor;
	});

/** 편집기에 초점을 줬다가 뺀다. */
const leave = (editor: Editor) =>
	act(() => {
		editor.view.dom.focus();
		fireEvent.blur(editor.view.dom);
	});

const type = (editor: Editor, html: string) =>
	act(() => {
		editor.commands.setContent(html, { emitUpdate: true });
	});

// 줄 순서: 0 첫 문단, 1 콜아웃 머리, 2 안쪽 문단, 3 둘째, 4 셋째, 5 넷째
describe("TranslationPairView", () => {
	it("진행률과 열 이름을 보인다", () => {
		setup(["translated", "translated", "translated", "translated", "untranslated", "changed"]);
		expect(screen.getByText("번역 4/6 · 미번역 1 · 원문 변경 1")).toBeDefined();
		expect(screen.getByText("KO 원문")).toBeDefined();
		expect(screen.getByText("EN")).toBeDefined();
	});

	it("보기 거르기는 맞지 않는 줄을 숨긴다", () => {
		const { rows } = setup(["translated", "translated", "translated", "untranslated", "changed", "translated"]);
		const total = rows.length;
		const count = () => document.querySelectorAll("[data-row-index]").length;
		expect(count()).toBe(total);

		fireEvent.click(screen.getByRole("button", { name: "미번역" }));
		expect(count()).toBe(1);
		expect(document.querySelector('[data-row-index="3"]')).not.toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "원문 변경" }));
		expect(count()).toBe(1);
		expect(document.querySelector('[data-row-index="4"]')).not.toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "전체" }));
		expect(count()).toBe(total);
	});

	it("빈 칸은 편집기에 미번역 안내를 보인다", async () => {
		setup(["translated", "translated", "translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 3);
		await editorIn(row);
		expect(within(row).getByText("미번역")).toBeDefined();
		// 번역이 있는 칸에는 안내가 없다.
		const done = rowAt(document.body, 4);
		await editorIn(done);
		expect(within(done).queryByText("미번역")).toBeNull();
	});

	it("입력한 뒤 초점을 잃으면 저장한다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"]);
		const row = rowAt(document.body, 3);
		const editor = await editorIn(row);
		type(editor, "<p>하나</p>");
		expect(within(row).queryByText("미번역")).toBeNull();
		leave(editor);
		expect(onChangeTarget).toHaveBeenCalledWith(3, "하나");
	});

	it("바꾸지 않고 초점만 잃으면 저장하지 않는다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "changed"]);
		const row = rowAt(document.body, 3);
		const editor = await editorIn(row);
		leave(editor);
		expect(onChangeTarget).not.toHaveBeenCalled();
	});

	it("블록이 둘이 되면 저장하지 않고 오류를 보인다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"]);
		const row = rowAt(document.body, 3);
		const editor = await editorIn(row);

		type(editor, "<p>하나</p><p>둘</p>");
		leave(editor);
		expect(within(row).getByRole("alert").textContent).toBe("블록 하나만");
		expect(onChangeTarget).not.toHaveBeenCalled();
		// 내용은 그대로 남는다.
		expect(editor.getText()).toContain("둘");

		// 다음 입력에서 오류가 사라진다.
		type(editor, "<p>하나</p>");
		expect(within(row).queryByRole("alert")).toBeNull();
		leave(editor);
		expect(onChangeTarget).toHaveBeenCalledWith(3, "하나");
	});

	it("다 지우면 번역을 비운다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "translated"]);
		const row = rowAt(document.body, 3);
		const editor = await editorIn(row);
		type(editor, "<p></p>");
		leave(editor);
		expect(onChangeTarget).toHaveBeenCalledWith(3, null);
	});

	it("Escape는 마지막으로 저장한 값으로 되돌린다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "translated"]);
		const row = rowAt(document.body, 3);
		const editor = await editorIn(row);
		const before = editor.getText();
		type(editor, "<p>고침</p>");
		fireEvent.keyDown(editor.view.dom, { key: "Escape" });
		expect(editor.getText()).toBe(before);
		expect(onChangeTarget).not.toHaveBeenCalled();
	});

	it("원문 복사는 원문 조각을 바로 저장한다", async () => {
		const { rows, onChangeTarget } = setup(["translated", "translated", "translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 3);
		await editorIn(row);
		fireEvent.click(within(row).getByRole("button", { name: "원문 복사" }));
		expect(onChangeTarget).toHaveBeenCalledWith(3, rows[3]?.unit.source);
		await waitFor(() => expect(within(row).queryByText("미번역")).toBeNull());
	});

	it("변경 무시는 그 줄 번호를 알린다", () => {
		const { onIgnoreChange } = setup(["translated", "translated", "translated", "changed", "translated"]);
		const row = rowAt(document.body, 3);
		expect(within(row).getByText("원문 변경됨")).toBeDefined();
		fireEvent.click(within(row).getByRole("button", { name: "변경 무시" }));
		expect(onIgnoreChange).toHaveBeenCalledWith(3);
	});

	it("비교는 이전·지금 원문을 펼친다", async () => {
		setup(["translated", "translated", "translated", "changed", "translated"]);
		const row = rowAt(document.body, 3);
		fireEvent.click(within(row).getByRole("button", { name: "비교" }));
		expect(within(row).getByText("이전")).toBeDefined();
		expect(within(row).getByText("지금")).toBeDefined();
		await waitFor(() => expect(row.textContent).toContain("(옛 원문)"));
	});

	it("머리 줄 입력은 초점을 잃으면 JSON으로 저장한다", () => {
		const { onChangeTarget } = setup(["translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 1);
		const input = within(row).getByLabelText("제목") as HTMLInputElement;
		expect(input.placeholder).toBe("미번역");
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.blur(input);
		expect(onChangeTarget).toHaveBeenCalledWith(1, JSON.stringify({ title: "Notice" }));
	});

	it("머리 줄은 Enter로도 저장하고 바꾸지 않으면 저장하지 않는다", () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated"]);
		const input = within(rowAt(document.body, 1)).getByLabelText("제목");
		fireEvent.blur(input);
		expect(onChangeTarget).not.toHaveBeenCalled();
		fireEvent.change(input, { target: { value: "Heads up" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onChangeTarget).toHaveBeenCalledWith(1, JSON.stringify({ title: "Heads up" }));
	});

	it("머리 줄을 모두 비우면 번역을 지운다", () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated"]);
		const input = within(rowAt(document.body, 1)).getByLabelText("제목");
		fireEvent.change(input, { target: { value: "" } });
		fireEvent.blur(input);
		expect(onChangeTarget).toHaveBeenCalledWith(1, null);
	});

	it("머리 줄 Escape는 입력을 되돌린다", () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated"]);
		const input = within(rowAt(document.body, 1)).getByLabelText("제목") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "고침" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input.value).toBe("Notice");
		expect(onChangeTarget).not.toHaveBeenCalled();
	});

	it("다음 미번역은 그 줄로 가서 편집기에 초점을 준다", async () => {
		setup(["translated", "translated", "untranslated", "translated", "untranslated"]);
		fireEvent.click(screen.getByRole("button", { name: "다음 미번역" }));
		const editor = await editorIn(rowAt(document.body, 2));
		await waitFor(() => expect(document.activeElement).toBe(editor.view.dom));
	});

	it("다음 미번역은 머리 줄 입력에도 초점을 준다", async () => {
		setup(["translated", "untranslated", "translated"]);
		fireEvent.click(screen.getByRole("button", { name: "다음 미번역" }));
		const input = within(rowAt(document.body, 1)).getByLabelText("제목");
		await waitFor(() => expect(document.activeElement).toBe(input));
	});

	it("읽기 전용이면 편집기가 잠기고 도구가 없다", async () => {
		setup(["translated", "translated", "translated", "untranslated"], { editable: false });
		expect(screen.queryByRole("button", { name: "원문 복사" })).toBeNull();
		const row = rowAt(document.body, 3);
		await waitFor(() => expect(within(row).getByText("미번역")).toBeDefined());
		expect(row.querySelector(".ProseMirror[contenteditable=true]")).toBeNull();
		expect(within(rowAt(document.body, 1)).getByLabelText<HTMLInputElement>("제목").readOnly).toBe(true);
	});

	it("원문을 해석할 수 없으면 안내만 보인다", () => {
		setup(["translated"], { sourceError: true });
		expect(screen.getByText("원문을 해석할 수 없습니다. 원문을 먼저 고치세요.")).toBeDefined();
		expect(document.querySelector("[data-row-index]")).toBeNull();
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
