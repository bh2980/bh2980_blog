import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import { AdminEntriesTable, columnsFor } from "../admin-entries-table";

afterEach(cleanup);

const item = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	title: id,
	slug: id,
	status: "draft",
	version: 1,
	folderId: null,
	categoryId: null,
	category: null,
	tagIds: [],
	tags: [],
	hasUnpublishedChanges: false,
	scheduledAt: null,
	publishedAt: null,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	trashedAt: null,
	...fields,
});

function renderTable(overrides: Partial<ComponentProps<typeof AdminEntriesTable>> = {}) {
	const props: ComponentProps<typeof AdminEntriesTable> = {
		collection: "post",
		items: [item("published", { status: "published", hasUnpublishedChanges: true }), item("draft")],
		folders: [],
		explorer: null,
		onColumnSettingsChange: vi.fn(),
		selectedIds: new Set(),
		onToggleSelect: vi.fn(),
		onToggleSelectPage: vi.fn(),
		total: 2,
		page: 1,
		pageSize: 25,
		sortField: "updatedAt",
		sortDirection: "desc",
		isLoading: false,
		errorMessage: null,
		isTrashView: false,
		onSortChange: vi.fn(),
		onPageChange: vi.fn(),
		onPageSizeChange: vi.fn(),
		onSelectFolder: vi.fn(),
		onOpenRecord: vi.fn(),
		onRestore: vi.fn(),
		onPermanentDelete: vi.fn(),
		onRetry: vi.fn(),
		...overrides,
	};
	render(<AdminEntriesTable {...props} />);
	return props;
}

describe("admin entry list", () => {
	it("uses the spec default columns per collection (§3.2)", () => {
		expect(columnsFor("post").defaults).toEqual(["title", "status", "category", "tags", "updatedAt", "publishedAt"]);
		expect(columnsFor("memo").defaults).toEqual(["title", "status", "tags", "updatedAt", "publishedAt"]);
		expect(columnsFor("memo").available).not.toContain("category");
		expect(columnsFor("tag").available).not.toContain("tags");
	});

	it("states status in text, including unpublished changes and schedules", () => {
		renderTable({
			items: [
				item("changed", { status: "published", hasUnpublishedChanges: true }),
				item("scheduled", { scheduledAt: new Date("2030-01-01T00:00:00Z") }),
			],
		});
		expect(screen.getByText("발행됨 · 수정 중")).toBeTruthy();
		expect(screen.getByText("초안 · 예약 2030-01-01 09:00")).toBeTruthy();
	});

	it("sorts through keyboard-reachable header buttons and exposes aria-sort", () => {
		const props = renderTable();
		const header = screen.getByRole("columnheader", { name: /수정일/ });
		expect(header.getAttribute("aria-sort")).toBe("descending");
		fireEvent.click(screen.getByRole("button", { name: /^발행일\s*$/ }));
		expect(props.onSortChange).toHaveBeenCalledWith("publishedAt");
	});

	it("persists column visibility and order and keeps page size numeric", () => {
		const props = renderTable();
		fireEvent.click(screen.getByRole("checkbox", { name: "생성일" }));
		expect(props.onColumnSettingsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ visibility: expect.objectContaining({ createdAt: true }) }),
		);
		fireEvent.click(screen.getByRole("button", { name: "상태 컬럼 위로" }));
		expect((props.onColumnSettingsChange as ReturnType<typeof vi.fn>).mock.lastCall?.[0].order.slice(0, 2)).toEqual([
			"status",
			"title",
		]);
		fireEvent.change(screen.getByRole("combobox", { name: "페이지 크기" }), { target: { value: "50" } });
		expect(props.onPageSizeChange).toHaveBeenCalledWith(50);
	});

	it("offers restore and permanent delete in the trash view", () => {
		const trashed = item("trashed", { status: "trashed" });
		const props = renderTable({ items: [trashed], isTrashView: true });
		const row = screen.getByRole("row", { name: /trashed/ });
		fireEvent.click(within(row).getByRole("button", { name: "복원" }));
		fireEvent.click(within(row).getByRole("button", { name: "영구 삭제" }));
		expect(props.onRestore).toHaveBeenCalledWith(trashed);
		expect(props.onPermanentDelete).toHaveBeenCalledWith(trashed);
	});

	it("opens record collections in their form instead of the editor", () => {
		const tag = item("tag-1", { collection: "tag", title: "TypeScript", status: "published" });
		const props = renderTable({ collection: "tag", items: [tag] });
		fireEvent.click(screen.getByRole("button", { name: "TypeScript" }));
		expect(props.onOpenRecord).toHaveBeenCalledWith(tag);
	});

	it("shows child folders in explorer mode and navigates up", () => {
		const props = renderTable({
			explorer: {
				folders: [{ id: "f2", collection: "post", parentId: "f1", name: "알고리즘", position: 0, version: 1 }],
				parent: "all",
			},
		});
		fireEvent.click(screen.getByRole("button", { name: "알고리즘" }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("f2");
		fireEvent.click(screen.getByRole("button", { name: ".. 상위 폴더로" }));
		expect(props.onSelectFolder).toHaveBeenCalledWith("all");
	});
});
