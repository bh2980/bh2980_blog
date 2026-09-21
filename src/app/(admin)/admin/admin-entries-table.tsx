"use client";

import { useState } from "react";
import Link from "next/link";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";

interface TableProps {
	collection: string;
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
	onRetry,
	currentFolderId,
	folders = [],
	onSelectFolder,
	onCreateFolder,
	onRenameFolder,
	onDeleteFolder,
}: TableProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const [isCreatingFolder, setIsCreatingFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");

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
	const subFolders = isExplorerMode
		? folders.filter((f) => (f.parentId ?? null) === (currentFolderId ?? null))
		: [];

	const handleFolderSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFolderName.trim() || !onCreateFolder) return;
		try {
			await onCreateFolder(newFolderName.trim(), currentFolderId ?? null);
			setNewFolderName("");
			setIsCreatingFolder(false);
		} catch (err: any) {
			alert("폴더 생성 실패: " + (err.message || String(err)));
		}
	};

	return (
		<main className="flex-1 flex flex-col overflow-hidden bg-neutral-950 p-6">
			{/* Top Bar: Controls */}
			<div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-800">
				<div className="flex flex-wrap items-center gap-3">
					<input
						type="text"
						placeholder="제목, slug 검색..."
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 w-64"
					/>

					<select
						value={statusFilter}
						onChange={(e) => onStatusChange(e.target.value)}
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
					>
						<option value="">전체 상태</option>
						<option value="draft">초안 (Draft)</option>
						<option value="published">공개 (Published)</option>
					</select>
				</div>

				<div className="flex items-center gap-3">
					<select
						value={pageSize}
						onChange={(e) => onPageSizeChange(Number(e.target.value) as 25 | 50 | 100)}
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
					>
						<option value={25}>25개씩 보기</option>
						<option value={50}>50개씩 보기</option>
						<option value={100}>100개씩 보기</option>
					</select>

					<button
						type="button"
						onClick={onCreateNew}
						className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition"
					>
						+ 새로 만들기
					</button>
				</div>
			</div>

			{/* Folder Path Breadcrumb (파일 탐색기 스타일 경로 안내) */}
			{onSelectFolder && (
				<div className="flex items-center justify-between py-2.5 px-3 border-b border-neutral-800/60 bg-neutral-900/20 text-xs">
					<div className="flex items-center gap-1.5 flex-wrap">
						<button
							type="button"
							onClick={() => onSelectFolder(null)}
							className={`flex items-center gap-1 hover:text-white transition ${
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
									className={`hover:text-white transition ${
										i === breadcrumb.length - 1
											? "font-semibold text-white"
											: "text-neutral-400"
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
									<input
										type="text"
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										placeholder="새 폴더 이름"
										className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-500"
										autoFocus
									/>
									<button
										type="submit"
										className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-white hover:bg-neutral-600"
									>
										확인
									</button>
									<button
										type="button"
										onClick={() => setIsCreatingFolder(false)}
										className="text-xs text-neutral-400 hover:text-white px-1"
									>
										취소
									</button>
								</form>
							) : (
								<button
									type="button"
									onClick={() => setIsCreatingFolder(true)}
									className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
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
				<div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-4 flex items-center justify-between text-sm text-red-200">
					<span>{errorMessage}</span>
					<button
						type="button"
						onClick={onRetry}
						className="text-xs underline hover:text-white ml-4"
					>
						다시 시도
					</button>
				</div>
			)}

			{/* Entries & Folders Table */}
			<div className="flex-1 overflow-y-auto mt-2 border border-neutral-800 rounded-lg">
				<table className="w-full text-left text-sm text-neutral-300">
					<thead className="bg-neutral-900/80 text-xs uppercase tracking-wider text-neutral-400 border-b border-neutral-800 sticky top-0 backdrop-blur z-10">
						<tr>
							<th className="px-4 py-3 w-10">
								<input
									type="checkbox"
									checked={items.length > 0 && items.every((i) => selectedIds.has(i.id))}
									onChange={(e) => onToggleSelectPage(e.target.checked)}
									aria-label="현재 페이지 전체 선택"
									className="accent-white"
								/>
							</th>
							<th
								className="px-4 py-3 cursor-pointer hover:text-white transition"
								onClick={() => onSortChange("title")}
							>
								이름 / 제목 {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
							</th>
							<th
								className="px-4 py-3 cursor-pointer hover:text-white transition"
								onClick={() => onSortChange("slug")}
							>
								Slug {sortField === "slug" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
							</th>
							<th className="px-4 py-3">상태</th>
							<th
								className="px-4 py-3 cursor-pointer hover:text-white transition"
								onClick={() => onSortChange("updatedAt")}
							>
								수정일 {sortField === "updatedAt" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
							</th>
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
								className="hover:bg-neutral-800/30 focus:bg-neutral-800/50 focus:outline-none transition cursor-pointer text-neutral-400 select-none"
							>
								<td className="px-4 py-2.5 text-center text-xs">📁</td>
								<td className="px-4 py-2.5 font-medium text-neutral-300 flex items-center gap-2">
									<span>..</span>
									<span className="text-xs text-neutral-500">(상위 폴더로 이동)</span>
								</td>
								<td className="px-4 py-2.5 text-xs text-neutral-600">-</td>
								<td className="px-4 py-2.5 text-xs text-neutral-600">-</td>
								<td className="px-4 py-2.5 text-xs text-neutral-600">-</td>
							</tr>
						)}

						{/* Explorer: 현재 폴더의 직속 하위 폴더 목록 */}
						{isExplorerMode &&
							subFolders.map((folder) => (
								<tr
									key={`folder-${folder.id}`}
									tabIndex={0}
									onClick={() => onSelectFolder?.(folder.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											onSelectFolder?.(folder.id);
										}
									}}
									className="group hover:bg-neutral-800/40 focus:bg-neutral-800/60 focus:outline-none transition cursor-pointer select-none"
								>
									<td className="px-4 py-2.5 text-center text-sm">
										📁
									</td>
									<td className="px-4 py-2.5 font-medium text-amber-200">
										<div className="flex items-center justify-between">
											<span className="hover:underline flex items-center gap-1.5">
												<span>{folder.name}</span>
											</span>

											{onRenameFolder && onDeleteFolder && (
												<div
													className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs text-neutral-400"
													onClick={(e) => e.stopPropagation()}
												>
													<button
														type="button"
														onClick={async () => {
															const next = prompt("폴더 이름 수정:", folder.name);
															if (next && next.trim() && next !== folder.name) {
																await onRenameFolder(folder.id, next.trim(), folder.version);
															}
														}}
														className="text-[11px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-neutral-700"
													>
														이름 수정
													</button>
													<button
														type="button"
														onClick={async () => {
															if (confirm(`'${folder.name}' 폴더를 삭제하시겠습니까? (하위 글은 보존됩니다)`)) {
																await onDeleteFolder(folder.id, folder.version);
															}
														}}
														className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-neutral-700"
													>
														삭제
													</button>
												</div>
											)}
										</div>
									</td>
									<td className="px-4 py-2.5 text-xs text-neutral-500">폴더</td>
									<td className="px-4 py-2.5 text-xs text-neutral-500">-</td>
									<td className="px-4 py-2.5 text-xs text-neutral-500">-</td>
								</tr>
							))}

						{/* 로딩 / 빈 목록 / 게시글 목록 */}
						{isLoading ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
									불러오는 중...
								</td>
							</tr>
						) : items.length === 0 && subFolders.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
									등록된 항목이 없습니다.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr key={item.id} className="hover:bg-neutral-800/40 transition">
									<td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
										<input
											type="checkbox"
											checked={selectedIds.has(item.id)}
											onChange={() => onToggleSelect(item.id)}
											aria-label={`${item.title ?? item.id} 선택`}
											className="accent-white"
										/>
									</td>
									<td className="px-4 py-3 font-medium text-white">
										{collection === "tag" || collection === "category" ? (
											<div className="flex items-center gap-2">
												<span>{item.title || <span className="text-neutral-500 italic">이름 없음</span>}</span>
												{onRenameRecord && (
													<button
														type="button"
														onClick={() => {
															const next = prompt("이름 수정:", item.title || "");
															if (next && next.trim() && next !== item.title) {
																onRenameRecord(item.id, next.trim(), item.version);
															}
														}}
														className="text-neutral-500 hover:text-white text-xs px-1.5 py-0.5 rounded border border-neutral-700 hover:border-neutral-500 bg-neutral-800 transition whitespace-nowrap"
														title="이름 수정"
													>
														이름 수정
													</button>
												)}
											</div>
										) : (
											<Link
												href={`/admin/entries/${item.id}/edit` as any}
												className="hover:underline hover:text-blue-400"
											>
												{item.title || <span className="text-neutral-500 italic">제목 없음</span>}
											</Link>
										)}
									</td>
									<td className="px-4 py-3 text-neutral-400 font-mono text-xs">
										{item.slug || <span className="text-neutral-600">-</span>}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
												item.status === "published"
													? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
													: "bg-neutral-800 text-neutral-300 border border-neutral-700"
											}`}
										>
											{item.status === "published" ? "공개" : "초안"}
										</span>
									</td>
									<td className="px-4 py-3 text-xs text-neutral-400">
										{new Date(item.updatedAt).toLocaleString("ko-KR")}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination Footer */}
			<div className="flex items-center justify-between pt-4 text-xs text-neutral-400 border-t border-neutral-800 mt-2">
				<div>
					총 <span className="font-semibold text-white">{total}</span>개 항목 중{" "}
					<span className="font-semibold text-white">
						{items.length > 0 ? (page - 1) * pageSize + 1 : 0} -{" "}
						{Math.min(page * pageSize, total)}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
						className="rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs hover:bg-neutral-800 disabled:opacity-40"
					>
						이전
					</button>
					<span className="px-1 text-neutral-300">
						{page} / {totalPages}
					</span>
					<button
						type="button"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
						className="rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs hover:bg-neutral-800 disabled:opacity-40"
					>
						다음
					</button>
				</div>
			</div>
		</main>
	);
}
