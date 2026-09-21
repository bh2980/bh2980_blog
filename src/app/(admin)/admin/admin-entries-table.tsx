"use client";

import Link from "next/link";
import type { ListEntriesItem } from "@/cms/adapters/postgres/content-store";

interface TableProps {
	items: ListEntriesItem[];
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
	onRetry: () => void;
}

export function AdminEntriesTable({
	items,
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
	onRetry,
}: TableProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<main className="flex-1 flex flex-col overflow-hidden bg-neutral-950 p-6">
			{/* Top Bar: Controls */}
			<div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
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
						className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
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

			{/* Error Banner */}
			{errorMessage && (
				<div className="mt-4 flex items-center justify-between rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
					<span>{errorMessage}</span>
					<button
						type="button"
						onClick={onRetry}
						className="rounded border border-red-700 bg-red-900/60 px-2.5 py-1 text-xs font-medium hover:bg-red-800"
					>
						다시 시도
					</button>
				</div>
			)}

			{/* Table Content */}
			<div className="flex-1 overflow-auto mt-4 rounded-lg border border-neutral-800 bg-neutral-900/30">
				<table className="w-full text-left text-sm text-neutral-300">
					<thead className="border-b border-neutral-800 bg-neutral-900/80 text-xs uppercase text-neutral-400">
						<tr>
							<th
								className="px-4 py-3 cursor-pointer hover:text-white transition"
								onClick={() => onSortChange("title")}
							>
								제목 {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
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
						{isLoading ? (
							<tr>
								<td colSpan={4} className="px-4 py-12 text-center text-neutral-500">
									불러오는 중...
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-4 py-12 text-center text-neutral-500">
									등록된 항목이 없습니다.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<tr key={item.id} className="hover:bg-neutral-800/40 transition">
									<td className="px-4 py-3 font-medium text-white">
										<Link
											href={`/admin/entries/${item.id}/edit` as any}
											className="hover:underline hover:text-blue-400"
										>
											{item.title || <span className="text-neutral-500 italic">제목 없음</span>}
										</Link>
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
					총 <span className="font-semibold text-white">{total}</span>개 중{" "}
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
