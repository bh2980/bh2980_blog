import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
		expect(within(toolbar).getByRole("button", { name: "링크 삽입·수정" })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: "정렬" })).toBeNull();

		fireEvent.click(more);
		fireEvent.click(await screen.findByRole("menuitem", { name: "가운데 정렬" }));
		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});
});
