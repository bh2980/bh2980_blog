import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import { AdminEntriesTable } from "../admin-entries-table";

afterEach(cleanup);

const item = (id: string, status: ListEntriesItem["status"]): ListEntriesItem => ({
	id,
	collection: "post",
	title: id,
	slug: id,
	status,
	version: 1,
	folderId: null,
	categoryId: null,
	tagIds: [],
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
});

function renderTable() {
	const onSearchChange = vi.fn();
	const onStatusChange = vi.fn();
	const onPageSizeChange = vi.fn();
	const onCreateNew = vi.fn();
	render(
		<AdminEntriesTable
			collection="post"
			items={[item("published-entry", "published"), item("draft-entry", "draft")]}
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
