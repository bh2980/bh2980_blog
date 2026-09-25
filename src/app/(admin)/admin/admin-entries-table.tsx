"use client";

import Link from "next/link";
import { useState } from "react";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import type { AdminColumnSettings, AdminListColumn } from "@/cms/core/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const ADMIN_COLUMNS: AdminListColumn[] = ["title", "slug", "tags", "status", "updatedAt"];
const ADMIN_COLUMN_LABELS: Record<AdminListColumn, string> = {
	title: "이름 / 제목",
	slug: "Slug",
	tags: "태그",
	status: "상태",
	updatedAt: "수정일",
};

interface TableProps {
	collection: string;
	columnSettings?: AdminColumnSettings;
	onColumnSettingsChange: (settings: AdminColumnSettings) => void;
	items: ListEntriesItem[];
	selectedIds: Set<string>;
	onToggleSelect: (id: string) => void;
	onToggleSelectPage: (selectAll: boolean) => void;
	total: number;
	page: number;
	pageSize: 25 | 50 | 100;
	search: string;
	statusFilter: string;
	sortField: "updatedAt" | "createdAt" | "title" | "slug";
	sortDirection: "asc" | "desc";
	isLoading: boolean;
	errorMessage: string | null;
	onSearchChange: (val: string) => void;
	onStatusChange: (val: string) => void;
	onSortChange: (field: "updatedAt" | "createdAt" | "title" | "slug") => void;
	onPageChange: (newPage: number) => void;
	onPageSizeChange: (newSize: 25 | 50 | 100) => void;
	onCreateNew: () => void;
	onRenameRecord?: (id: string, newTitle: string, version: number) => Promise<void>;
	onOpenEditRecord?: (item: ListEntriesItem) => void;
	onRetry: () => void;

	// Folder Explorer Navigation
	currentFolderId?: string | null;
	folders?: Folder[];
	onSelectFolder?: (folderId: string | null) => void;
	onCreateFolder?: (name: string, parentId: string | null) => Promise<void>;
	onRenameFolder?: (id: string, name: string, version: number) => Promise<void>;
	onDeleteFolder?: (id: string, version: number) => Promise<void>;
}

export function AdminEntriesTable({
	collection,
	columnSettings,
	onColumnSettingsChange,
	items,
	selectedIds,
	onToggleSelect,
	onToggleSelectPage,
	total,
	page,
	pageSize,
	search,
	statusFilter,
	sortField,
	sortDirection,
	isLoading,
	errorMessage,
	onSearchChange,
	onStatusChange,
	onSortChange,
	onPageChange,
	onPageSizeChange,
	onCreateNew,
	onRenameRecord,
	onOpenEditRecord,
	onRetry,
	currentFolderId,
	folders = [],
	onSelectFolder,
	onCreateFolder,
	onRenameFolder,
	onDeleteFolder,
}: TableProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const availableColumns = ADMIN_COLUMNS.filter(
		(column) => column !== "tags" || collection === "post" || collection === "memo",
	);
	const savedOrder = (columnSettings?.order ?? []).filter((column) => availableColumns.includes(column));
	const columnOrder = [...new Set([...savedOrder, ...availableColumns])];
	const columnVisibility = Object.fromEntries(
		availableColumns.map((column) => [column, columnSettings?.visibility?.[column] ?? true]),
	) as Record<AdminListColumn, boolean>;
	const visibleColumns = columnOrder.filter((column) => columnVisibility[column] !== false);
	const tableColumnCount = visibleColumns.length + 1;
	const [isCreatingFolder, setIsCreatingFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");

	// Custom Dialog / Inline states replacing window.prompt/confirm/alert
	const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string; version: number } | null>(null);
	const [renameInput, setRenameInput] = useState("");
	const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; version: number } | null>(null);
	const [errorDialogMsg, setErrorDialogMsg] = useState<string | null>(null);

	// Build breadcrumb trail from current folder up to root
	const breadcrumb: Folder[] = [];
	if (currentFolderId && folders.length > 0) {
		let curr = folders.find((f) => f.id === currentFolderId);
		while (curr) {
			breadcrumb.unshift(curr);
			curr = curr.parentId ? folders.find((f) => f.id === curr!.parentId) : undefined;
		}
	}

	const currentFolder = currentFolderId ? folders.find((f) => f.id === currentFolderId) : null;
	const parentFolderId = currentFolder ? (currentFolder.parentId ?? null) : null;

	// Show subfolders when no search/status filters are active (Folder Explorer Mode)
	const isExplorerMode = !search.trim() && !statusFilter && Boolean(onSelectFolder);
	const subFolders = isExplorerMode ? folders.filter((f) => (f.parentId ?? null) === (currentFolderId ?? null)) : [];

	const handleFolderSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFolderName.trim() || !onCreateFolder) return;
		try {
			await onCreateFolder(newFolderName.trim(), currentFolderId ?? null);
			setNewFolderName("");
			setIsCreatingFolder(false);
		} catch (err: any) {
			setErrorDialogMsg("폴더 생성 실패: " + (err.message || String(err)));
		}
	};

	const handleConfirmRename = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!renamingFolder || !onRenameFolder) return;
		const trimmed = renameInput.trim();
		if (!trimmed || trimmed === renamingFolder.name) {
			setRenamingFolder(null);
			return;
		}
		try {
			await onRenameFolder(renamingFolder.id, trimmed, renamingFolder.version);
			setRenamingFolder(null);
		} catch (err: any) {
			setErrorDialogMsg("폴더 이름 수정 실패: " + (err.message || String(err)));
		}
	};

	const handleConfirmDelete = async () => {
		if (!deletingFolder || !onDeleteFolder) return;
		try {
			await onDeleteFolder(deletingFolder.id, deletingFolder.version);
			setDeletingFolder(null);
		} catch (err: any) {
			setErrorDialogMsg("폴더 삭제 실패: " + (err.message || String(err)));
		}
	};

	const updateColumnSettings = (order: AdminListColumn[], visibility = columnVisibility) => {
		onColumnSettingsChange({ order, visibility });
	};

	const moveColumn = (column: AdminListColumn, direction: -1 | 1) => {
		const index = columnOrder.indexOf(column);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= columnOrder.length) return;
		const nextOrder = [...columnOrder];
		[nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
		updateColumnSettings(nextOrder);
	};

	const renderEntryColumn = (item: ListEntriesItem, column: AdminListColumn) => {
		switch (column) {
			case "title":
				return collection === "tag" || collection === "category" ? (
					<div className="flex items-center gap-2">
						<span>{item.title || <span className="text-neutral-500 italic">이름 없음</span>}</span>
						{(onOpenEditRecord || onRenameRecord) && (
							<button
								type="button"
								onClick={() => {
									if (onOpenEditRecord) onOpenEditRecord(item);
									else onRenameRecord?.(item.id, item.title || "", item.version);
								}}
								className="whitespace-nowrap rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-neutral-500 text-xs transition hover:border-neutral-500 hover:text-white"
								title="이름 수정"
							>
								이름 수정
							</button>
						)}
					</div>
				) : (
					<Link href={`/admin/entries/${item.id}/edit` as any} className="hover:text-blue-400 hover:underline">
						{item.title || <span className="text-neutral-500 italic">제목 없음</span>}
					</Link>
				);
			case "slug":
				return (
					<span className="font-mono text-neutral-400 text-xs">
						{item.slug || <span className="text-neutral-600">-</span>}
					</span>
				);
			case "tags":
				return item.tags.length ? (
					<div className="flex flex-wrap gap-1">
						{item.tags.map((tag) => (
							<span
								key={tag.id}
								className="max-w-32 truncate rounded border border-neutral-700 px-1.5 py-0.5 text-neutral-300 text-xs"
							>
								{tag.title}
							</span>
						))}
					</div>
				) : (
					<span className="text-neutral-600">-</span>
				);
			case "status":
				return (
					<Badge
						variant="outline"
						className={
							item.status === "published"
								? "border-emerald-800/50 bg-emerald-950/80 text-emerald-400"
								: "border-neutral-700 bg-neutral-800 text-neutral-300"
						}
					>
						{item.status === "published" ? "공개" : "초안"}
					</Badge>
				);
			case "updatedAt":
				return <span className="text-neutral-400 text-xs">{new Date(item.updatedAt).toLocaleString("ko-KR")}</span>;
		}
	};

	const renderFolderColumn = (folder: Folder, isRenamingThis: boolean, column: AdminListColumn) => {
		if (column === "slug") return <span className="text-neutral-500 text-xs">폴더</span>;
		if (column !== "title") return <span className="text-neutral-500 text-xs">-</span>;
		if (isRenamingThis) {
			return (
				<form
					onSubmit={handleConfirmRename}
					className="flex items-center gap-1.5"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<Input
						type="text"
						aria-label="폴더 이름 변경"
						value={renameInput}
						onChange={(e) => setRenameInput(e.target.value)}
						className="h-auto w-40 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-white text-xs shadow-none focus:border-neutral-400 focus:outline-none focus-visible:border-neutral-400 focus-visible:ring-0 md:text-xs dark:bg-neutral-900"
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Escape") setRenamingFolder(null);
						}}
					/>
					<button
						type="submit"
						className="rounded bg-neutral-700 px-1.5 py-0.5 text-[11px] text-white hover:bg-neutral-600"
					>
						저장
					</button>
					<button
						type="button"
						onClick={() => setRenamingFolder(null)}
						className="px-1 text-[11px] text-neutral-400 hover:text-white"
					>
						취소
					</button>
				</form>
			);
		}
		return (
			<div className="flex items-center justify-between">
				<span>{folder.name}</span>
				{onRenameFolder && onDeleteFolder && (
					<div className="flex items-center gap-2 text-neutral-400 text-xs opacity-0 group-hover:opacity-100">
						<button
							type="button"
							onClick={() => {
								setRenamingFolder(folder);
								setRenameInput(folder.name);
							}}
							className="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:bg-neutral-700 hover:text-white"
						>
							이름 수정
						</button>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setDeletingFolder(folder);
							}}
							className="rounded px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-neutral-700 hover:text-red-300"
						>
							삭제
						</button>
					</div>
				)}
			</div>
		);
	};

	return (
		<main className="flex flex-1 flex-col overflow-hidden bg-neutral-950 p-6">
			{/* Top Bar: Controls */}
			<div className="flex flex-wrap items-center justify-between gap-4 border-neutral-800 border-b pb-4">
				<div className="flex flex-wrap items-center gap-3">
					<Input
						type="text"
						aria-label="제목, slug 검색"
						placeholder="제목, slug 검색..."
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className="h-auto w-64 rounded-lg border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white placeholder-neutral-500 shadow-none focus:border-neutral-600 focus:outline-none focus-visible:border-neutral-600 focus-visible:ring-0 dark:bg-neutral-900"
					/>

					<NativeSelect
						aria-label="상태 필터"
						value={statusFilter}
						onChange={(e) => onStatusChange(e.target.value)}
						className="h-auto rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 pr-9 text-neutral-300 text-sm shadow-none focus:border-neutral-600 focus:outline-none focus-visible:border-neutral-600 focus-visible:ring-0 dark:bg-neutral-900 dark:hover:bg-neutral-900"
					>
						<option value="">전체 상태</option>
						<option value="draft">초안 (Draft)</option>
						<option value="published">공개 (Published)</option>
					</NativeSelect>
				</div>

				<div className="flex items-center gap-3">
					<details className="relative">
						<summary className="cursor-pointer select-none whitespace-nowrap rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-300 text-sm hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500">
							열 설정
						</summary>
						<div className="fixed inset-x-4 top-36 z-40 max-h-[calc(100vh-10rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-64">
							<p className="mb-2 text-neutral-400 text-xs">
								이름 / 제목 열은 필수입니다. 다른 열의 표시와 순서를 설정합니다.
							</p>
							<ul className="space-y-1">
								{columnOrder.map((column, index) => {
									const visible = columnVisibility[column] !== false;
									const onlyVisibleColumn = visibleColumns.length <= 1;
									return (
										<li
											key={column}
											className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-neutral-800"
										>
											<label className="flex min-w-0 items-center gap-2 text-neutral-200 text-sm">
												<input
													type="checkbox"
													checked={visible}
													disabled={column === "title" || (visible && onlyVisibleColumn)}
													aria-label={`${ADMIN_COLUMN_LABELS[column]} 열 표시`}
													onChange={(event) => {
														if (column === "title" || (visible && onlyVisibleColumn)) return;
														updateColumnSettings(columnOrder, { ...columnVisibility, [column]: event.target.checked });
													}}
													className="accent-white"
												/>
												<span className="truncate">{ADMIN_COLUMN_LABELS[column]}</span>
											</label>
											<div className="flex shrink-0 gap-1">
												<Button
													type="button"
													variant="outline"
													size="sm"
													aria-label={`${ADMIN_COLUMN_LABELS[column]} 열 위로`}
													disabled={index === 0}
													onClick={() => moveColumn(column, -1)}
													className="h-7 w-7 border-neutral-700 bg-neutral-900 p-0 text-xs shadow-none"
												>
													↑
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													aria-label={`${ADMIN_COLUMN_LABELS[column]} 열 아래로`}
													disabled={index === columnOrder.length - 1}
													onClick={() => moveColumn(column, 1)}
													className="h-7 w-7 border-neutral-700 bg-neutral-900 p-0 text-xs shadow-none"
												>
													↓
												</Button>
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					</details>
					<NativeSelect
						aria-label="페이지 크기"
						value={pageSize}
						onChange={(e) => onPageSizeChange(Number(e.target.value) as 25 | 50 | 100)}
						className="h-auto rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 pr-9 text-neutral-300 text-sm shadow-none focus:border-neutral-600 focus:outline-none focus-visible:border-neutral-600 focus-visible:ring-0 dark:bg-neutral-900 dark:hover:bg-neutral-900"
					>
						<option value={25}>25개씩 보기</option>
						<option value={50}>50개씩 보기</option>
						<option value={100}>100개씩 보기</option>
					</NativeSelect>

					<Button
						type="button"
						onClick={onCreateNew}
						className="h-auto rounded-lg bg-white px-4 py-1.5 font-semibold text-neutral-950 text-sm shadow-none transition hover:bg-neutral-200 focus-visible:ring-neutral-500/50"
					>
						+ 새로 만들기
					</Button>
				</div>
			</div>

			{/* Folder Path Breadcrumb (파일 탐색기 스타일 경로 안내) */}
			{onSelectFolder && (
				<div className="flex items-center justify-between border-neutral-800/60 border-b bg-neutral-900/20 px-3 py-2.5 text-xs">
					<div className="flex flex-wrap items-center gap-1.5">
						<button
							type="button"
							onClick={() => onSelectFolder(null)}
							className={`flex items-center gap-1 transition hover:text-white ${
								!currentFolderId ? "font-semibold text-white" : "text-neutral-400"
							}`}
						>
							<span>📁</span>
							<span>전체 (루트)</span>
						</button>
						{breadcrumb.map((f, i) => (
							<span key={f.id} className="flex items-center gap-1.5">
								<span className="text-neutral-600">/</span>
								<button
									type="button"
									onClick={() => onSelectFolder(f.id)}
									className={`transition hover:text-white ${
										i === breadcrumb.length - 1 ? "font-semibold text-white" : "text-neutral-400"
									}`}
								>
									{f.name}
								</button>
							</span>
						))}
					</div>

					{onCreateFolder && (
						<div>
							{isCreatingFolder ? (
								<form onSubmit={handleFolderSubmit} className="flex items-center gap-1.5">
									<Input
										type="text"
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										aria-label="새 폴더 이름"
										placeholder="새 폴더 이름"
										className="h-auto w-40 rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-white text-xs shadow-none focus:border-neutral-500 focus:outline-none focus-visible:border-neutral-500 focus-visible:ring-0 md:text-xs dark:bg-neutral-800"
									/>
									<button
										type="submit"
										className="rounded bg-neutral-700 px-2 py-0.5 text-white text-xs hover:bg-neutral-600"
									>
										확인
									</button>
									<button
										type="button"
										onClick={() => setIsCreatingFolder(false)}
										className="px-1 text-neutral-400 text-xs hover:text-white"
									>
										취소
									</button>
								</form>
							) : (
								<button
									type="button"
									onClick={() => setIsCreatingFolder(true)}
									className="flex items-center gap-1 text-neutral-400 text-xs hover:text-white"
								>
									<span>+ 현재 위치에 새 폴더</span>
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Error Alert */}
			{errorMessage && (
				<div className="mt-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-200 text-sm">
					<span>{errorMessage}</span>
					<button type="button" onClick={onRetry} className="ml-4 text-xs underline hover:text-white">
						다시 시도
					</button>
				</div>
			)}

			{/* Entries & Folders Table */}
			<div className="mt-2 flex-1 overflow-y-auto rounded-lg border border-neutral-800">
				<table className="w-full text-left text-neutral-300 text-sm">
					<thead className="sticky top-0 z-10 border-neutral-800 border-b bg-neutral-900/80 text-neutral-400 text-xs uppercase tracking-wider backdrop-blur">
						<tr>
							<th className="w-10 px-4 py-3">
								<input
									type="checkbox"
									checked={items.length > 0 && items.every((i) => selectedIds.has(i.id))}
									onChange={(e) => onToggleSelectPage(e.target.checked)}
									aria-label="현재 페이지 전체 선택"
									className="accent-white"
								/>
							</th>
							{visibleColumns.map((column) => {
								const sortableField = column === "title" || column === "slug" || column === "updatedAt" ? column : null;
								return (
									<th key={column} className="px-4 py-3">
										{sortableField ? (
											<button
												type="button"
												aria-label={`${ADMIN_COLUMN_LABELS[column]} 기준 정렬`}
												aria-pressed={sortField === sortableField}
												onClick={() => onSortChange(sortableField)}
												className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
											>
												{ADMIN_COLUMN_LABELS[column]}{" "}
												{sortField === sortableField ? (sortDirection === "asc" ? "▲" : "▼") : ""}
											</button>
										) : (
											ADMIN_COLUMN_LABELS[column]
										)}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-800/60">
						{/* Explorer: 상위 폴더 (..) 이동 행 */}
						{isExplorerMode && currentFolderId !== null && (
							<tr
								tabIndex={0}
								onClick={() => onSelectFolder?.(parentFolderId)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelectFolder?.(parentFolderId);
									}
								}}
								className="cursor-pointer select-none text-neutral-400 transition hover:bg-neutral-800/30 focus:bg-neutral-800/50 focus:outline-none"
							>
								<td className="px-4 py-2.5 text-center text-xs">📁</td>
								{visibleColumns.map((column) => (
									<td key={column} className="px-4 py-2.5 text-neutral-600 text-xs">
										{column === "title" ? (
											<span className="font-medium text-neutral-300">.. (상위 폴더로 이동)</span>
										) : (
											"-"
										)}
									</td>
								))}
							</tr>
						)}

						{/* Explorer: 현재 폴더의 직속 하위 폴더 목록 */}
						{isExplorerMode &&
							subFolders.map((folder) => {
								const isRenamingThis = renamingFolder?.id === folder.id;
								return (
									<tr
										key={`folder-${folder.id}`}
										tabIndex={isRenamingThis ? -1 : 0}
										onClick={() => {
											if (!isRenamingThis) onSelectFolder?.(folder.id);
										}}
										onKeyDown={(e) => {
											if (!isRenamingThis && (e.key === "Enter" || e.key === " ")) {
												e.preventDefault();
												onSelectFolder?.(folder.id);
											}
										}}
										className={`group cursor-pointer select-none transition hover:bg-neutral-800/40 focus:bg-neutral-800/60 focus:outline-none ${
											isRenamingThis ? "bg-neutral-800/50" : ""
										}`}
									>
										<td className="px-4 py-2.5 text-center text-sm">📁</td>
										{visibleColumns.map((column) => (
											<td key={column} className="px-4 py-2.5 font-medium text-white">
												{renderFolderColumn(folder, isRenamingThis, column)}
											</td>
										))}
									</tr>
								);
							})}

						{/* 로딩 / 빈 목록 / 게시글 목록 */}
						{isLoading ? (
							<tr>
								<td colSpan={tableColumnCount} className="px-4 py-12 text-center text-neutral-500">
									불러오는 중...
								</td>
							</tr>
						) : items.length === 0 && subFolders.length === 0 ? (
							<tr>
								<td colSpan={tableColumnCount} className="px-4 py-12 text-center text-neutral-500">
									등록된 항목이 없습니다.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr key={item.id} className="transition hover:bg-neutral-800/40">
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedIds.has(item.id)}
											onClick={(e) => e.stopPropagation()}
											onChange={() => onToggleSelect(item.id)}
											aria-label={`${item.title ?? item.id} 선택`}
											className="accent-white"
										/>
									</td>
									{visibleColumns.map((column) => (
										<td key={column} className="px-4 py-3 font-medium text-white">
											{renderEntryColumn(item, column)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination Footer */}
			<div className="mt-2 flex items-center justify-between border-neutral-800 border-t pt-4 text-neutral-400 text-xs">
				<div>
					총 <span className="font-semibold text-white">{total}</span>개 항목 중{" "}
					<span className="font-semibold text-white">
						{items.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
						className="h-auto rounded border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs shadow-none hover:bg-neutral-800 hover:text-neutral-200 focus-visible:ring-neutral-500/50 disabled:opacity-40 dark:bg-neutral-900"
					>
						이전
					</Button>
					<span className="px-1 text-neutral-300">
						{page} / {totalPages}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
						className="h-auto rounded border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs shadow-none hover:bg-neutral-800 hover:text-neutral-200 focus-visible:ring-neutral-500/50 disabled:opacity-40 dark:bg-neutral-900"
					>
						다음
					</Button>
				</div>
			</div>

			<Dialog open={Boolean(deletingFolder)} onOpenChange={(open) => !open && setDeletingFolder(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>폴더 삭제 확인</DialogTitle>
						<DialogDescription>
							&apos;{deletingFolder?.name}&apos; 폴더를 삭제하시겠습니까? 폴더 안의 하위 글과 하위 폴더는 보존됩니다.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setDeletingFolder(null)}
							className="rounded-lg border px-3 py-1.5 font-medium text-xs"
						>
							취소
						</button>
						<button
							type="button"
							onClick={handleConfirmDelete}
							className="rounded-lg border px-3 py-1.5 font-semibold text-xs"
						>
							삭제하기
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(errorDialogMsg)} onOpenChange={(open) => !open && setErrorDialogMsg(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>오류 발생</DialogTitle>
						<DialogDescription>{errorDialogMsg}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setErrorDialogMsg(null)}
							className="rounded-lg border px-4 py-1.5 font-semibold text-xs"
						>
							확인
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
