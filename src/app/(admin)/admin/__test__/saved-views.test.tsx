import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedView } from "@/cms/core/api";
import { SavedViews } from "../saved-views";

afterEach(cleanup);

const views: SavedView[] = [
	{ id: "v1", name: "수정 중", query: "changes=1&sortField=updatedAt&sortDirection=desc" },
	{ id: "v2", name: "초안", query: "status=draft&sortField=updatedAt&sortDirection=desc" },
];

function renderViews(props: Partial<Parameters<typeof SavedViews>[0]> = {}) {
	const all = {
		views,
		activeId: "",
		currentQuery: "sortField=updatedAt&sortDirection=desc",
		onOpen: vi.fn(),
		onOpenAll: vi.fn(),
		onChange: vi.fn(),
		...props,
	};
	render(<SavedViews {...all} />);
	return all;
}

describe("saved views (v2 A4)", () => {
	it("opens a view and marks the current one", () => {
		const props = renderViews({ activeId: "v2", currentQuery: views[1]?.query });
		expect(screen.getByRole("button", { name: "초안" }).getAttribute("aria-current")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "수정 중" }));
		expect(props.onOpen).toHaveBeenCalledWith(views[0]);
		fireEvent.click(screen.getByRole("button", { name: "전체" }));
		expect(props.onOpenAll).toHaveBeenCalled();
	});

	it("saves the current conditions as a new view and opens it", async () => {
		const props = renderViews({ currentQuery: "tag=t1&sortField=title&sortDirection=asc" });
		fireEvent.click(screen.getByRole("button", { name: "현재 조건을 새 보기로 저장" }));
		fireEvent.change(await screen.findByLabelText("보기 이름"), { target: { value: " 리액트 " } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		const [next, openId] = (props.onChange as ReturnType<typeof vi.fn>).mock.lastCall ?? [];
		expect(next).toHaveLength(3);
		expect(next[2]).toMatchObject({ name: "리액트", query: "tag=t1&sortField=title&sortDirection=asc" });
		expect(openId).toBe(next[2].id);
	});

	it("shows 변경됨 when the open view's conditions change and saves them back into it", () => {
		const props = renderViews({
			activeId: "v1",
			currentQuery: "changes=1&tag=t1&sortField=updatedAt&sortDirection=desc",
		});
		expect(screen.getByText(/변경됨/)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		expect(props.onChange).toHaveBeenCalledWith(
			[{ ...views[0], query: "changes=1&tag=t1&sortField=updatedAt&sortDirection=desc", columns: undefined }, views[1]],
			"v1",
		);
	});

	it("renames with F2 and deletes from the view menu", async () => {
		const props = renderViews({ activeId: "v2", currentQuery: views[1]?.query });
		fireEvent.keyDown(screen.getByRole("button", { name: "초안" }), { key: "F2" });
		const input = await screen.findByLabelText("보기 이름");
		fireEvent.change(input, { target: { value: "초안 모음" } });
		fireEvent.click(screen.getByRole("button", { name: "이름 변경" }));
		expect(props.onChange).toHaveBeenLastCalledWith([views[0], { ...views[1], name: "초안 모음" }]);
		await waitFor(() => expect(screen.queryByLabelText("보기 이름")).toBeNull());

		fireEvent.click(screen.getByRole("button", { name: "'초안' 보기 관리" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "삭제" }));
		expect(props.onChange).toHaveBeenLastCalledWith([views[0]]);
	});
});
