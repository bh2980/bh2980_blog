import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import { AdminEntriesTable } from "../admin-entries-table";

afterEach(cleanup);

const item = (
	id: string,
	status: ListEntriesItem["status"],
	fields: Partial<ListEntriesItem> = {},
): ListEntriesItem => ({
	id,
	collection: "post",
	title: id,
	slug: id,
	status,
	version: 1,
	folderId: null,
	categoryId: null,
	tagIds: [],
	tags: [],
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	...fields,
});

function renderTable(
	items = [item("published-entry", "published"), item("draft-entry", "draft")],
	onColumnSettingsChange = vi.fn(),
) {
	const onSearchChange = vi.fn();
	const onStatusChange = vi.fn();
	const onPageSizeChange = vi.fn();
	const onCreateNew = vi.fn();
	render(
		<AdminEntriesTable
			collection="post"
			items={items}
			columnSettings={undefined}
			onColumnSettingsChange={onColumnSettingsChange}
			selectedIds={new Set()}
			onToggleSelect={vi.fn()}
			onToggleSelectPage={vi.fn()}
			total={2}
			page={1}
			pageSize={25}
			search=""
			statusFilter=""
			sortField="updatedAt"
			sortDirection="desc"
			isLoading={false}
			errorMessage={null}
			onSearchChange={onSearchChange}
			onStatusChange={onStatusChange}
			onSortChange={vi.fn()}
			onPageChange={vi.fn()}
			onPageSizeChange={onPageSizeChange}
			onCreateNew={onCreateNew}
			onRetry={vi.fn()}
		/>,
	);
	return { onSearchChange, onStatusChange, onPageSizeChange, onCreateNew };
}

describe("admin entry list primitives", () => {
	it("keeps native filter events and numeric page-size values", () => {
		const { onStatusChange, onPageSizeChange } = renderTable();
		const status = screen.getByRole("combobox", { name: "상태 필터" });
		const pageSize = screen.getByRole("combobox", { name: "페이지 크기" });

		fireEvent.change(status, { target: { value: "published" } });
		fireEvent.change(pageSize, { target: { value: "50" } });

		expect(onStatusChange).toHaveBeenCalledWith("published");
		expect(onPageSizeChange).toHaveBeenCalledWith(50);
	});

	it("renders published and draft states with their existing neutral colors", () => {
		renderTable();
		const published = screen.getByText("공개");
		const draft = screen.getByText("초안");

		expect(published.getAttribute("data-slot")).toBe("badge");
		expect(published.className).toContain("bg-emerald-950/80");
		expect(published.className).toContain("text-emerald-400");
		expect(draft.getAttribute("data-slot")).toBe("badge");
		expect(draft.className).toContain("bg-neutral-800");
	});

	it("renders tag names and persists visibility and order changes", () => {
		const onColumnSettingsChange = vi.fn();
		renderTable(
			[item("tagged-entry", "draft", { tags: [{ id: "tag-1", title: "TypeScript" }] })],
			onColumnSettingsChange,
		);

		expect(screen.getByText("TypeScript")).toBeTruthy();
		fireEvent.click(screen.getByText("열 설정"));
		fireEvent.click(screen.getByRole("checkbox", { name: "태그 열 표시" }));
		expect(onColumnSettingsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ visibility: expect.objectContaining({ tags: false }) }),
		);

		fireEvent.click(screen.getByRole("button", { name: "태그 열 위로" }));
		expect(onColumnSettingsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ order: ["title", "tags", "slug", "status", "updatedAt"] }),
		);
	});

	it("uses the shared search input and create button without changing callbacks", () => {
		const { onSearchChange, onCreateNew } = renderTable();
		fireEvent.change(screen.getByRole("textbox", { name: "제목, slug 검색" }), {
			target: { value: "draft" },
		});
		fireEvent.click(screen.getByRole("button", { name: "+ 새로 만들기" }));

		expect(onSearchChange).toHaveBeenCalledWith("draft");
		expect(onCreateNew).toHaveBeenCalledTimes(1);
	});
});
