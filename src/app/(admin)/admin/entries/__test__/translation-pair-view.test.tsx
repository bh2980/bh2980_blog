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

	it("원문 복사는 원문 조각을 번역으로 넘긴다", () => {
		const { rows, onChangeTarget } = setup(["translated", "translated", "translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 3);
		fireEvent.click(within(row).getByRole("button", { name: "원문 복사" }));
		expect(onChangeTarget).toHaveBeenCalledWith(3, rows[3]?.unit.source);
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

	it("머리 줄 입력은 JSON으로 저장한다", () => {
		const { onChangeTarget } = setup(["translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 1);
		fireEvent.click(within(row).getByRole("button", { name: "번역하기" }));
		const input = within(row).getByLabelText("제목") as HTMLInputElement;
		expect(input.placeholder).toBe("알림");
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.click(within(row).getByRole("button", { name: "완료" }));
		expect(onChangeTarget).toHaveBeenCalledWith(1, JSON.stringify({ title: "Notice" }));
	});

	it("머리 줄을 모두 비우면 번역을 지운다", () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated"]);
		const row = rowAt(document.body, 1);
		fireEvent.click(within(row).getByRole("button", { name: "번역 편집" }));
		fireEvent.change(within(row).getByLabelText("제목"), { target: { value: "" } });
		fireEvent.click(within(row).getByRole("button", { name: "완료" }));
		expect(onChangeTarget).toHaveBeenCalledWith(1, null);
	});

	it("Escape는 편집을 취소한다", () => {
		const { onChangeTarget } = setup(["translated", "untranslated", "translated"]);
		const row = rowAt(document.body, 1);
		fireEvent.click(within(row).getByRole("button", { name: "번역하기" }));
		const input = within(row).getByLabelText("제목");
		fireEvent.change(input, { target: { value: "Notice" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(within(row).queryByLabelText("제목")).toBeNull();
		expect(onChangeTarget).not.toHaveBeenCalled();
	});

	it("다음 미번역은 그 줄의 편집을 연다", async () => {
		setup(["translated", "translated", "untranslated", "translated", "untranslated"]);
		fireEvent.click(screen.getByRole("button", { name: "다음 미번역" }));
		await waitFor(() =>
			expect(within(rowAt(document.body, 2)).getByRole("group", { name: "번역 편집" })).toBeDefined(),
		);
	});

	it("읽기 전용이면 편집 동작이 없다", () => {
		setup(["translated", "untranslated", "changed"], { editable: false });
		expect(screen.queryByRole("button", { name: "번역하기" })).toBeNull();
		expect(screen.queryByRole("button", { name: "원문 복사" })).toBeNull();
		expect(screen.queryByRole("button", { name: "변경 무시" })).toBeNull();
		expect(screen.queryByRole("button", { name: "번역 편집" })).toBeNull();
	});

	it("원문을 해석할 수 없으면 안내만 보인다", () => {
		setup(["translated"], { sourceError: true });
		expect(screen.getByText("원문을 해석할 수 없습니다. 원문을 먼저 고치세요.")).toBeDefined();
		expect(document.querySelector("[data-row-index]")).toBeNull();
	});

	it("블록 편집기는 블록이 둘이 되면 막는다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"]);
		const row = rowAt(document.body, 3);
		fireEvent.click(within(row).getByRole("button", { name: "번역하기" }));
		const dom = await waitFor(() => {
			const element = row.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror[contenteditable=true]");
			if (!element?.editor) throw new Error("editor not ready");
			return element;
		});
		const editor = dom.editor as Editor;

		act(() => {
			editor.commands.setContent("<p>하나</p><p>둘</p>", { emitUpdate: true });
		});
		fireEvent.click(within(row).getByRole("button", { name: "완료" }));
		expect(within(row).getByRole("alert").textContent).toBe("블록 하나만");
		expect(onChangeTarget).not.toHaveBeenCalled();

		act(() => {
			editor.commands.setContent("<p>하나</p>", { emitUpdate: true });
		});
		fireEvent.click(within(row).getByRole("button", { name: "완료" }));
		expect(onChangeTarget).toHaveBeenCalledWith(3, "하나");
	});

	it("편집기 밖을 누르면 편집을 끝내며 저장한다", async () => {
		const { onChangeTarget } = setup(["translated", "translated", "translated", "untranslated"]);
		const row = rowAt(document.body, 3);
		fireEvent.click(within(row).getByRole("button", { name: "번역하기" }));
		const dom = await waitFor(() => {
			const element = row.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror[contenteditable=true]");
			if (!element?.editor) throw new Error("editor not ready");
			return element;
		});
		act(() => {
			(dom.editor as Editor).commands.setContent("<p>바깥</p>", { emitUpdate: true });
		});
		fireEvent.mouseDown(document.body);
		expect(onChangeTarget).toHaveBeenCalledWith(3, "바깥");
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
	});
});
