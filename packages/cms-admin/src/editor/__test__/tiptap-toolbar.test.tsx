import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CmsEditor } from "../tiptap-editor";

// jsdom에는 글자 범위의 좌표가 없다. 서식을 적용한 뒤 ProseMirror가 커서 위치를 잴 때 쓴다.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const renderEditor = async () => {
	const onChange = vi.fn();
	render(<CmsEditor content="안녕하세요" onChange={onChange} />);
	await screen.findByRole("toolbar", { name: "서식 도구" });
	return onChange;
};
const toolbarButtonNames = (toolbar: HTMLElement) =>
	within(toolbar)
		.getAllByRole("button")
		.map((button) => button.getAttribute("aria-label") || button.textContent);
const savedText = (onChange: ReturnType<typeof vi.fn>) => String(onChange.mock.lastCall?.[0] ?? "");

describe("서식 도구 묶음", () => {
	it("정렬·첨자는 아이콘 하나짜리 드롭다운이고 개별 버튼은 없다", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: "서식 도구" });

		expect(within(toolbar).getByRole("button", { name: "정렬" })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: "첨자" })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: "왼쪽 정렬" })).toBeNull();
		expect(within(toolbar).queryByRole("button", { name: "위첨자" })).toBeNull();
		// 폭을 잴 수 없으면(jsdom) 전부 보이고 더보기는 그리지 않는다.
		expect(within(toolbar).queryByRole("button", { name: "더보기" })).toBeNull();
	});

	it("링크 버튼은 커서가 링크 안에 있으면 눌린 상태다", async () => {
		let editor: Editor | null = null;
		render(
			<CmsEditor
				content="[주소](https://example.com) 뒤"
				onChange={vi.fn()}
				onEditor={(ready) => {
					editor = ready;
				}}
			/>,
		);
		const toolbar = await screen.findByRole("toolbar", { name: "서식 도구" });
		await waitFor(() => expect(editor).not.toBeNull());
		expect(within(toolbar).getByRole("button", { name: "링크" }).getAttribute("aria-pressed")).toBe("false");
		act(() => {
			(editor as unknown as Editor).commands.setTextSelection(2);
		});
		await waitFor(() =>
			expect(within(toolbar).getByRole("button", { name: "링크" }).getAttribute("aria-pressed")).toBe("true"),
		);
	});

	it("정렬 메뉴에서 가운데를 고르면 문단이 가운데 정렬된다", async () => {
		const onChange = await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "정렬" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "가운데 정렬" }));

		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("첨자 메뉴에 위첨자·아래첨자가 있다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "첨자" }));

		expect(await screen.findByRole("menuitem", { name: "위첨자" })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: "아래첨자" })).toBeTruthy();
	});

	it("폭이 좁으면 덜 쓰는 도구부터 더보기로 접고 메뉴에서 그대로 쓴다", async () => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 32,
			height: 32,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 32,
			bottom: 32,
			toJSON: () => ({}),
		});
		const onChange = await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: "서식 도구" });

		const more = await within(toolbar).findByRole("button", { name: "더보기" });
		// 고정 도구는 남고, 우선순위가 가장 낮은 정렬은 접힌다.
		expect(within(toolbar).getByRole("button", { name: "굵게" })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: "링크" })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: "정렬" })).toBeNull();

		fireEvent.click(more);
		fireEvent.click(await screen.findByRole("menuitem", { name: "가운데 정렬" }));
		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("도구 이름과 순서가 정해져 있다", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: "서식 도구" });

		// 문단 모양 → 글자 꾸밈 → 글자에 붙이기(링크·툴팁) → 목록·정렬 → 블록 넣기 순이다.
		expect(toolbarButtonNames(toolbar)).toEqual([
			"문단",
			"굵게",
			"기울임",
			"밑줄",
			"취소선",
			"인라인 코드",
			"글자색",
			"첨자",
			"링크",
			"툴팁",
			"목록",
			"정렬",
			"인용구",
			"코드 블록",
			"표",
			"구분선",
			"업로드",
			"컴포넌트 넣기",
			"본문 폭",
		]);
	});

	it("블록 모양 메뉴는 문단·제목 2~4이다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "문단" }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			"문단",
			"제목 2",
			"제목 3",
			"제목 4",
		]);
	});

	it("목록 메뉴는 글머리·번호·체크 목록이다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "목록" }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			"글머리 목록",
			"번호 목록",
			"체크 목록",
		]);
	});

	it.each([
		[400, ["문단", "굵게", "기울임", "글자색", "링크", "툴팁", "목록", "더보기", "본문 폭"]],
		[
			500,
			["문단", "굵게", "기울임", "인라인 코드", "글자색", "링크", "툴팁", "목록", "코드 블록", "더보기", "본문 폭"],
		],
	])("폭 %ipx에서는 정해진 우선순위대로 도구를 남긴다", async (width, visible) => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 32,
			height: 32,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 32,
			bottom: 32,
			toJSON: () => ({}),
		});
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: "서식 도구" });

		await within(toolbar).findByRole("button", { name: "더보기" });
		expect(toolbarButtonNames(toolbar)).toEqual(visible);
	});
});
