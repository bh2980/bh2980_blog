import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type EntryData, type EntryForm, type EntryFormPatch, formFromEntry } from "../entry-form";
import type { PreviewMode } from "../translation-preview";
import { TranslationWorkspace } from "../translation-workspace";

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

// 미리보기는 받은 값만 보이고 블록 고르기를 흉내 낸다.
vi.mock("../translation-preview", () => ({
	TranslationPreview: ({
		rows,
		mode,
		selected,
		onSelect,
	}: {
		rows: readonly unknown[];
		mode: PreviewMode;
		selected: number | null;
		onSelect: (index: number) => void;
	}) => (
		<div data-testid="preview" data-mode={mode} data-selected={selected ?? ""}>
			{rows.map((_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: 테스트용 고정 목록
				<button key={index} type="button" onClick={() => onSelect(index)}>
					블록 {index}
				</button>
			))}
		</div>
	),
}));

afterEach(cleanup);

const SOURCE = "첫 문단\n\n둘째 문단\n\n셋째 문단\n";

const entry = (targets: (string | null)[]): EntryData => ({
	id: "en-id",
	collection: "post",
	locale: "en",
	translationGroupId: "ko-id",
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: "slug",
	publishedSlug: null,
	working: {
		metadata: { title: "Title" },
		mdx: "",
		translation: {
			version: 1,
			units: ["첫 문단", "둘째 문단", "셋째 문단"].map((source, index) => ({
				key: "|block|paragraph",
				source,
				target: targets[index] ?? null,
			})),
		} as never,
	},
});

let latestForm: EntryForm;

function Harness({
	targets,
	sourceMdx = SOURCE,
	editable = true,
}: {
	targets: (string | null)[];
	sourceMdx?: string;
	editable?: boolean;
}) {
	const [form, setFormState] = useState(() => formFromEntry(entry(targets)));
	latestForm = form;
	const setForm = (patch: EntryFormPatch) => setFormState((current) => ({ ...current, ...patch }) as EntryForm);
	return (
		<TranslationWorkspace
			header={<h1>머리</h1>}
			sourceMdx={sourceMdx}
			sourceLocale="ko"
			targetLocale="en"
			form={form}
			setForm={setForm}
			editable={editable}
		/>
	);
}

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

const selectedOf = () => screen.getByTestId("preview").getAttribute("data-selected");

describe("TranslationWorkspace", () => {
	it("진행률을 보이고 아무것도 고르지 않았으면 안내를 보인다", () => {
		render(<Harness targets={["First", null, null]} />);
		expect(screen.getByText("번역 1/3 · 미번역 2")).toBeDefined();
		expect(screen.getByText("블록을 누르면 번역합니다.")).toBeDefined();
		expect(selectedOf()).toBe("");
	});

	it("블록을 고르면 패널에 원문과 번역 편집기를 보인다", async () => {
		render(<Harness targets={["First", null, null]} />);
		fireEvent.click(screen.getByRole("button", { name: "블록 1" }));
		expect(selectedOf()).toBe("1");
		expect(screen.getByText("2/3")).toBeDefined();
		await editorIn();
		await waitFor(() => expect(within(screen.getByLabelText("번역 패널")).getByText("미번역")).toBeDefined());
	});

	it("저장하면 번역을 폼에 넣고 그 블록에 머문다", async () => {
		render(<Harness targets={["First", null, null]} />);
		fireEvent.click(screen.getByRole("button", { name: "블록 1" }));
		const editor = await editorIn();
		type(editor, "<p>Second</p>");
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(latestForm.mdx).toBe("First\n\nSecond\n");
		expect(selectedOf()).toBe("1");
		expect(screen.getByText("번역 2/3 · 미번역 1")).toBeDefined();
	});

	it("다른 블록으로 옮기기 전에 고치던 내용을 저장한다", async () => {
		render(<Harness targets={["First", null, null]} />);
		fireEvent.click(screen.getByRole("button", { name: "블록 1" }));
		const editor = await editorIn();
		type(editor, "<p>Second</p>");
		fireEvent.click(screen.getByRole("button", { name: "블록 2" }));
		expect(latestForm.mdx).toBe("First\n\nSecond\n");
		expect(selectedOf()).toBe("2");
	});

	it("고치던 내용이 잘못됐으면 옮기지 않는다", async () => {
		render(<Harness targets={["First", null, null]} />);
		fireEvent.click(screen.getByRole("button", { name: "블록 1" }));
		const editor = await editorIn();
		type(editor, "<p>하나</p><p>둘</p>");
		fireEvent.click(screen.getByRole("button", { name: "블록 2" }));
		expect(selectedOf()).toBe("1");
		expect(screen.getByRole("alert").textContent).toBe("블록 하나만");
		fireEvent.click(screen.getByRole("button", { name: "다음 블록" }));
		fireEvent.click(screen.getByRole("button", { name: "닫기" }));
		expect(selectedOf()).toBe("1");
	});

	it("이전·다음 블록과 닫기로 고른 블록을 바꾼다", () => {
		render(<Harness targets={["First", "Second", "Third"]} />);
		fireEvent.click(screen.getByRole("button", { name: "블록 1" }));
		fireEvent.click(screen.getByRole("button", { name: "다음 블록" }));
		expect(selectedOf()).toBe("2");
		fireEvent.click(screen.getByRole("button", { name: "이전 블록" }));
		fireEvent.click(screen.getByRole("button", { name: "이전 블록" }));
		expect(selectedOf()).toBe("0");
		fireEvent.click(screen.getByRole("button", { name: "닫기" }));
		expect(selectedOf()).toBe("");
	});

	it("다음 미번역은 고른 블록 뒤의 미번역을 고르고 끝에서 처음으로 돌아간다", () => {
		render(<Harness targets={[null, "Second", null]} />);
		const next = screen.getByRole("button", { name: "다음 미번역" });
		fireEvent.click(next);
		expect(selectedOf()).toBe("0");
		fireEvent.click(next);
		expect(selectedOf()).toBe("2");
		fireEvent.click(next);
		expect(selectedOf()).toBe("0");
	});

	it("다음 미번역은 미번역이 없으면 막힌다", () => {
		render(<Harness targets={["First", "Second", "Third"]} />);
		expect(screen.getByRole("button", { name: "다음 미번역" }).hasAttribute("disabled")).toBe(true);
	});

	it("원문으로 보기는 미리보기를 원문 보기로 바꾼다", () => {
		render(<Harness targets={["First", null, null]} />);
		const toggle = screen.getByRole("button", { name: "원문으로 보기" });
		expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("translation");
		fireEvent.click(toggle);
		expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("source");
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(toggle);
		expect(screen.getByTestId("preview").getAttribute("data-mode")).toBe("translation");
	});

	it("원문을 해석할 수 없으면 안내만 보인다", () => {
		render(<Harness targets={[null, null, null]} sourceMdx={"<Callout>"} />);
		expect(screen.getByText("원문을 해석할 수 없습니다. 원문을 먼저 고치세요.")).toBeDefined();
		expect(screen.queryByTestId("preview")).toBeNull();
	});
});
