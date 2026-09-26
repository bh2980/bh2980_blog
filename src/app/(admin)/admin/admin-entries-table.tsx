"use client";

import Link from "next/link";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import {
	ADMIN_LIST_COLUMNS,
	type AdminColumnSettings,
	type AdminListColumn,
	type ListSortField,
	PAGE_SIZES,
	type PageSize,
} from "@/cms/core/api";
import { isRecordCollection } from "@/cms/core/collections";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { writeDraggedEntries } from "./shared/entry-drag";
import { describeEntryStatus } from "./shared/entry-status";
import type { FolderActions } from "./shared/use-folder-actions";

export const COLUMN_LABELS: Record<AdminListColumn, string> = {
	title: "제목",
	status: "상태",
	category: "카테고리",
	tags: "태그",
	updatedAt: "수정일",
	publishedAt: "발행일",
	createdAt: "생성일",
	slug: "주소",
	folder: "폴더",
};

const SORTABLE: Partial<Record<AdminListColumn, ListSortField>> = {
	title: "title",
	slug: "slug",
	updatedAt: "updatedAt",
	createdAt: "createdAt",
	publishedAt: "publishedAt",
};

/** 컬렉션에서 쓸 수 있는 컬럼과 기본 표시(§3.2). */
export function columnsFor(collection: string): { available: AdminListColumn[]; defaults: AdminListColumn[] } {
	const isPost = collection === "post";
	const isContent = isPost || collection === "memo";
	const available = ADMIN_LIST_COLUMNS.filter((column) => {
		if (column === "category") return isPost;
		if (column === "tags" || column === "publishedAt") return isContent;
		return true;
	});
	const defaults: AdminListColumn[] = isPost
		? ["title", "status", "category", "tags", "updatedAt", "publishedAt"]
		: isContent
			? ["title", "status", "tags", "updatedAt", "publishedAt"]
			: ["title", "slug", "status", "updatedAt"];
	return { available, defaults };
}

const formatDate = (value: Date | string | null) => (value ? new Date(value).toLocaleString("ko-KR") : "—");

interface TableProps {
	collection: string;
	items: ListEntriesItem[];
	folders: Folder[];
	/** 폴더 탐색 모드에서 목록 위에 보여 줄 하위 폴더와 상위 폴더 이동. */
	explorer: { folders: Folder[]; parent: string | null } | null;
	columnSettings?: AdminColumnSettings;
	onColumnSettingsChange: (settings: AdminColumnSettings) => void;
	selectedIds: Set<string>;
	onToggleSelect: (id: string) => void;
	onToggleSelectPage: (selectAll: boolean) => void;
	total: number;
	page: number;
	pageSize: PageSize;
	sortField: ListSortField;
	sortDirection: "asc" | "desc";
	isLoading: boolean;
	errorMessage: string | null;
	isTrashView: boolean;
	folderActions?: FolderActions;
	onSortChange: (field: ListSortField) => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: PageSize) => void;
	onSelectFolder: (folder: string) => void;
	onOpenRecord: (item: ListEntriesItem) => void;
	onRestore: (item: ListEntriesItem) => void;
	onPermanentDelete: (item: ListEntriesItem) => void;
	onRetry: () => void;
}

export function AdminEntriesTable({
	collection,
	items,
	folders,
	explorer,
	columnSettings,
	onColumnSettingsChange,
	selectedIds,
	onToggleSelect,
	onToggleSelectPage,
	total,
	page,
	pageSize,
	sortField,
	sortDirection,
	isLoading,
	errorMessage,
	isTrashView,
	folderActions,
	onSortChange,
	onPageChange,
	onPageSizeChange,
	onSelectFolder,
	onOpenRecord,
	onRestore,
	onPermanentDelete,
	onRetry,
}: TableProps) {
	const isRecord = isRecordCollection(collection);
	const { available, defaults } = columnsFor(collection);
	const savedOrder = (columnSettings?.order ?? []).filter((column) => available.includes(column));
	const order = [...new Set([...savedOrder, ...defaults, ...available])];
	const isVisible = (column: AdminListColumn) =>
		column === "title" || (columnSettings?.visibility?.[column] ?? defaults.includes(column));
	const visibleColumns = order.filter(isVisible);
	const colSpan = visibleColumns.length + 2;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const folderName = (id: string | null) => (id ? (folders.find((folder) => folder.id === id)?.name ?? "—") : "미분류");

	const updateColumns = (nextOrder: AdminListColumn[], visibility: Record<string, boolean>) =>
		onColumnSettingsChange({ order: nextOrder, visibility });
	const currentVisibility = Object.fromEntries(order.map((column) => [column, isVisible(column)]));
	const moveColumn = (column: AdminListColumn, direction: -1 | 1) => {
		const index = order.indexOf(column);
		const target = index + direction;
		if (target < 0 || target >= order.length) return;
		const next = [...order];
		[next[index], next[target]] = [next[target] as AdminListColumn, next[index] as AdminListColumn];
		updateColumns(next, currentVisibility);
	};

	const cell = (item: ListEntriesItem, column: AdminListColumn) => {
		switch (column) {
			case "title": {
				const title = item.title || <span className="text-neutral-500 italic">제목 없음</span>;
				return isRecord ? (
					<button
						type="button"
						onClick={() => onOpenRecord(item)}
						className="text-left hover:text-blue-400 hover:underline"
					>
						{title}
					</button>
				) : (
					<Link href={`/admin/entries/${item.id}/edit`} className="hover:text-blue-400 hover:underline">
						{title}
					</Link>
				);
			}
			case "status":
				// 색상만으로 상태를 전달하지 않는다(§3.2).
				return (
					<span className={item.status === "published" ? "text-emerald-400" : "text-neutral-300"}>
						{describeEntryStatus(item)}
					</span>
				);
			case "category":
				return item.category?.title ?? <span className="text-neutral-600">—</span>;
			case "tags":
				return item.tags.length ? (
					<span className="flex flex-wrap gap-1">
						{item.tags.map((tag) => (
							<span
								key={tag.id}
								className="max-w-32 truncate rounded border border-neutral-700 px-1.5 py-0.5 text-neutral-300 text-xs"
							>
								{tag.title}
							</span>
						))}
					</span>
				) : (
					<span className="text-neutral-600">—</span>
				);
			case "updatedAt":
				return <span className="text-neutral-400 text-xs">{formatDate(item.updatedAt)}</span>;
			case "createdAt":
				return <span className="text-neutral-400 text-xs">{formatDate(item.createdAt)}</span>;
			case "publishedAt":
				return <span className="text-neutral-400 text-xs">{formatDate(item.publishedAt)}</span>;
			case "slug":
				return <span className="font-mono text-neutral-400 text-xs">{item.slug || "—"}</span>;
			case "folder":
				return <span className="text-neutral-400 text-xs">{folderName(item.folderId)}</span>;
		}
	};

	const selectClass =
		"h-auto rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 pr-9 text-neutral-300 text-sm shadow-none dark:bg-neutral-900";

	return (
		<section aria-label="항목 목록" className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-4">
			<div className="flex items-center justify-end gap-2 py-2">
				<details className="relative">
					<summary className="cursor-pointer select-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-300 text-sm hover:bg-neutral-800">
						컬럼 설정
					</summary>
					<div className="absolute top-full right-0 z-40 mt-2 w-64 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
						<p className="mb-2 text-neutral-400 text-xs">제목은 항상 보입니다. 표시와 순서는 컬렉션별로 저장됩니다.</p>
						<ul className="space-y-1">
							{order.map((column, index) => (
								<li
									key={column}
									className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-neutral-800"
								>
									<label className="flex items-center gap-2 text-neutral-200 text-sm">
										<input
											type="checkbox"
											checked={isVisible(column)}
											disabled={column === "title"}
											onChange={(event) =>
												updateColumns(order, { ...currentVisibility, [column]: event.target.checked })
											}
										/>
										{COLUMN_LABELS[column]}
									</label>
									<span className="flex gap-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 w-7 p-0"
											aria-label={`${COLUMN_LABELS[column]} 컬럼 위로`}
											disabled={index === 0}
											onClick={() => moveColumn(column, -1)}
										>
											↑
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-7 w-7 p-0"
											aria-label={`${COLUMN_LABELS[column]} 컬럼 아래로`}
											disabled={index === order.length - 1}
											onClick={() => moveColumn(column, 1)}
										>
											↓
										</Button>
									</span>
								</li>
							))}
						</ul>
					</div>
				</details>
				<NativeSelect
					aria-label="페이지 크기"
					value={pageSize}
					onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
					className={selectClass}
				>
					{PAGE_SIZES.map((size) => (
						<option key={size} value={size}>
							{size}개씩 보기
						</option>
					))}
				</NativeSelect>
			</div>

			{errorMessage && (
				<div
					role="alert"
					className="mb-2 flex items-center justify-between rounded-lg border border-red-800 bg-red-950/50 p-3 text-red-200 text-sm"
				>
					<span>{errorMessage}</span>
					<button type="button" onClick={onRetry} className="text-xs underline">
						다시 시도
					</button>
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-neutral-800">
				<table className="w-full text-left text-neutral-300 text-sm">
					<thead className="sticky top-0 z-10 border-neutral-800 border-b bg-neutral-900/90 text-neutral-400 text-xs backdrop-blur">
						<tr>
							<th className="w-10 px-4 py-3">
								<input
									type="checkbox"
									checked={items.length > 0 && items.every((item) => selectedIds.has(item.id))}
									onChange={(event) => onToggleSelectPage(event.target.checked)}
									aria-label="현재 페이지 전체 선택"
								/>
							</th>
							{visibleColumns.map((column) => {
								const sortable = SORTABLE[column];
								const active = sortable === sortField;
								return (
									<th
										key={column}
										className="px-4 py-3"
										aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
									>
										{sortable ? (
											<button type="button" onClick={() => onSortChange(sortable)} className="hover:text-white">
												{COLUMN_LABELS[column]} {active ? (sortDirection === "asc" ? "▲" : "▼") : ""}
											</button>
										) : (
											COLUMN_LABELS[column]
										)}
									</th>
								);
							})}
							<th className="px-4 py-3">
								<span className="sr-only">작업</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-800/60">
						{explorer && explorer.parent !== null && (
							<tr className="text-neutral-400">
								<td className="px-4 py-2 text-center text-xs" aria-hidden>
									📁
								</td>
								<td colSpan={colSpan - 1} className="px-4 py-2">
									<button
										type="button"
										onClick={() => onSelectFolder(explorer.parent ?? "all")}
										className="hover:text-white"
									>
										.. 상위 폴더로
									</button>
								</td>
							</tr>
						)}
						{explorer?.folders.map((folder) => (
							<tr key={`folder-${folder.id}`} className="group">
								<td className="px-4 py-2 text-center" aria-hidden>
									📁
								</td>
								<td colSpan={colSpan - 2} className="px-4 py-2 font-medium text-white">
									<button type="button" onClick={() => onSelectFolder(folder.id)} className="hover:underline">
										{folder.name}
									</button>
								</td>
								<td className="px-4 py-2 text-right text-xs">
									{folderActions && (
										<span className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
											<button
												type="button"
												onClick={() => folderActions.requestRename(folder)}
												className="px-1.5 hover:text-white"
											>
												이름 변경
											</button>
											<button
												type="button"
												onClick={() => void folderActions.requestDelete(folder)}
												className="px-1.5 text-red-400"
											>
												삭제
											</button>
										</span>
									)}
								</td>
							</tr>
						))}
						{isLoading ? (
							<tr>
								<td colSpan={colSpan} className="px-4 py-12 text-center text-neutral-500" aria-busy>
									불러오는 중...
								</td>
							</tr>
						) : items.length === 0 && !explorer?.folders.length ? (
							<tr>
								<td colSpan={colSpan} className="px-4 py-12 text-center text-neutral-500">
									{isTrashView ? "휴지통이 비었습니다." : "조건에 맞는 항목이 없습니다."}
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr
									key={item.id}
									draggable={!isTrashView}
									onDragStart={(event) => {
										// 선택한 행을 끌면 선택 전체를, 아니면 이 행만 옮긴다.
										const group = selectedIds.has(item.id) ? items.filter((row) => selectedIds.has(row.id)) : [item];
										writeDraggedEntries(
											event,
											group.map((row) => ({ id: row.id, expectedVersion: row.version })),
										);
									}}
									className="hover:bg-neutral-800/40"
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedIds.has(item.id)}
											onChange={() => onToggleSelect(item.id)}
											aria-label={`${item.title ?? "제목 없음"} 선택`}
										/>
									</td>
									{visibleColumns.map((column) => (
										<td key={column} className="px-4 py-3 font-medium text-white">
											{cell(item, column)}
										</td>
									))}
									<td className="whitespace-nowrap px-4 py-3 text-right text-xs">
										{item.status === "trashed" && (
											<>
												<button type="button" onClick={() => onRestore(item)} className="px-1.5 hover:text-white">
													복원
												</button>
												<button type="button" onClick={() => onPermanentDelete(item)} className="px-1.5 text-red-400">
													영구 삭제
												</button>
											</>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<nav aria-label="페이지 이동" className="flex items-center justify-between pt-3 text-neutral-400 text-xs">
				<span>
					총 <span className="font-semibold text-white">{total}</span>개 중{" "}
					{items.length > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0"}
				</span>
				<span className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
						className="h-7 text-xs"
					>
						이전
					</Button>
					<span>
						{page} / {totalPages}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
						className="h-7 text-xs"
					>
						다음
					</Button>
				</span>
			</nav>
		</section>
	);
}
