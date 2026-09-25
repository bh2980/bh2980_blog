"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import type { AdminColumnSettings } from "@/cms/core/api";
import type { Collection } from "@/cms/services/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { AdminEntriesTable } from "./admin-entries-table";
import { AdminSidebar } from "./admin-sidebar";
import { cmsApiErrorMessage } from "./api-error-message";
import { BulkBar } from "./entries/bulk-bar";

export function AdminClientDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Initialize state from URL params
	const urlCollection = (searchParams.get("collection") as Collection) || "post";
	const urlFolderId = searchParams.get("folderId") || null;
	const urlSearch = searchParams.get("search") || "";
	const urlStatus = searchParams.get("status") || "";
	const urlPage = parseInt(searchParams.get("page") || "1", 10);
	const urlPageSize = (parseInt(searchParams.get("pageSize") || "25", 10) as 25 | 50 | 100) || 25;
	const urlSortField = (searchParams.get("sortField") as "updatedAt" | "createdAt" | "title" | "slug") || "updatedAt";
	const urlSortDirection = (searchParams.get("sortDirection") as "asc" | "desc") || "desc";

	const [currentCollection, setCurrentCollection] = useState<Collection>(urlCollection);
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(urlFolderId);
	const [folders, setFolders] = useState<Folder[]>([]);

	const [items, setItems] = useState<ListEntriesItem[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(urlPage);
	const [pageSize, setPageSize] = useState<25 | 50 | 100>(urlPageSize);
	// Debounced search state: updates committed search only after 300ms idle,
	// so fetchEntries (driven by the committed value) fires once per pause.
	// Debounced search state: updates committedSearch only after 300ms idle,
	// so fetchEntries (driven by committedSearch) fires once per pause.
	const [search, setSearch] = useState(urlSearch);
	const [committedSearch, setCommittedSearch] = useState(urlSearch);
	const [statusFilter, setStatusFilter] = useState(urlStatus);
	const [sortField, setSortField] = useState<"updatedAt" | "createdAt" | "title" | "slug">(urlSortField);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">(urlSortDirection);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [recordModalError, setRecordModalError] = useState<string | null>(null);
	const [columnSettings, setColumnSettings] = useState<Partial<Record<Collection, AdminColumnSettings>>>({});

	// Sync state to URL search parameters
	const syncUrl = useCallback(
		(params: {
			collection?: Collection;
			folderId?: string | null;
			search?: string;
			status?: string;
			page?: number;
			pageSize?: number;
			sortField?: string;
			sortDirection?: string;
		}) => {
			const query = new URLSearchParams(searchParams.toString());
			if (params.collection !== undefined) query.set("collection", params.collection);
			if (params.folderId !== undefined) {
				if (params.folderId) query.set("folderId", params.folderId);
				else query.delete("folderId");
			}
			if (params.search !== undefined) {
				if (params.search) query.set("search", params.search);
				else query.delete("search");
			}
			if (params.status !== undefined) {
				if (params.status) query.set("status", params.status);
				else query.delete("status");
			}
			if (params.page !== undefined) query.set("page", String(params.page));
			if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
			if (params.sortField !== undefined) query.set("sortField", params.sortField);
			if (params.sortDirection !== undefined) query.set("sortDirection", params.sortDirection);

			router.replace(`?${query.toString()}`, { scroll: false });
		},
		[router, searchParams],
	);

	// Load Preferences on initial mount only if not overridden by explicit URL
	const preferencesLoadedRef = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: guarded one-time preference hydration
	useEffect(() => {
		if (preferencesLoadedRef.current) return;
		preferencesLoadedRef.current = true;

		fetch("/api/cms/v1/preferences")
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) {
					if (data.columnSettings) {
						setColumnSettings((current) => ({ ...data.columnSettings, ...current }));
					}
					if (!searchParams.has("pageSize") && data.defaultPageSize) {
						setPageSize(data.defaultPageSize);
					}
					if (!searchParams.has("sortField") && data.sort?.field) {
						setSortField(data.sort.field);
						setSortDirection(data.sort.direction);
					}
				}
			})
			.catch(() => {});
	}, []); // mount only

	// Save Preferences when changed
	const savePreferences = (newSize?: 25 | 50 | 100, field?: string, dir?: string) => {
		fetch("/api/cms/v1/preferences", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				defaultPageSize: newSize ?? pageSize,
				sort: {
					field: field ?? sortField,
					direction: dir ?? sortDirection,
				},
			}),
		}).catch(() => {});
	};

	const saveColumnSettings = (settings: AdminColumnSettings) => {
		setColumnSettings((current) => ({ ...current, [currentCollection]: settings }));
		fetch("/api/cms/v1/preferences", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ columnSettings: { [currentCollection]: settings } }),
		}).catch(() => {});
	};

	// Fetch Folders
	const fetchFolders = useCallback(async () => {
		try {
			const res = await fetch(`/api/cms/v1/folders?collection=${currentCollection}`);
			if (res.ok) {
				const data = await res.json();
				setFolders(data);
			}
		} catch (err) {
			console.error("Failed to load folders", err);
		}
	}, [currentCollection]);

	// Fetch Entries with Race Condition Cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchEntries = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		const controller = new AbortController();
		abortControllerRef.current = controller;

		setIsLoading(true);
		setErrorMessage(null);
		try {
			const params = new URLSearchParams();
			params.set("collection", currentCollection);
			if (committedSearch) params.set("search", committedSearch);
			if (statusFilter) params.set("status", statusFilter);
			if (currentFolderId) params.set("folderId", currentFolderId);
			params.set("sortField", sortField);
			params.set("sortDirection", sortDirection);
			params.set("page", String(page));
			params.set("pageSize", String(pageSize));

			const res = await fetch(`/api/cms/v1/entries?${params.toString()}`, {
				signal: controller.signal,
			});

			if (res.ok) {
				const data = await res.json();
				setItems(data.items);
				setTotal(data.total);
			} else {
				const err = await res.json().catch(() => ({}));
				setErrorMessage(err.message || "목록을 불러오지 못했습니다.");
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setErrorMessage("네트워크 오류가 발생했습니다.");
			}
		} finally {
			setIsLoading(false);
		}
	}, [currentCollection, currentFolderId, committedSearch, statusFilter, sortField, sortDirection, page, pageSize]);

	useEffect(() => {
		fetchFolders();
	}, [fetchFolders]);

	useEffect(() => {
		fetchEntries();
	}, [fetchEntries]);

	// Bulk selection is limited to the current page (M4-FE-2).
	// biome-ignore lint/correctness/useExhaustiveDependencies: selection must reset when the visible page query changes
	useEffect(() => {
		setSelectedIds(new Set());
	}, [currentCollection, currentFolderId, committedSearch, statusFilter, sortField, sortDirection, page, pageSize]);

	// Debounced search input handler
	const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
	useEffect(() => {
		return () => {
			if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
		};
	}, []);
	const handleSearchChange = (val: string) => {
		setSearch(val);
		setPage(1);
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}
		searchDebounceRef.current = setTimeout(() => {
			setCommittedSearch(val);
			syncUrl({ search: val, page: 1 });
		}, 300);
	};

	const handleCreateFolder = async (name: string, parentId: string | null) => {
		const res = await fetch("/api/cms/v1/folders", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				collection: currentCollection,
				name,
				parentId,
			}),
		});
		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.message || "폴더 생성 실패");
		}
		await fetchFolders();
	};

	const handleRenameFolder = async (id: string, name: string, version: number) => {
		const res = await fetch(`/api/cms/v1/folders/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name,
				expectedVersion: version,
			}),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message || "폴더 수정 실패");
		}
		await fetchFolders();
	};

	const handleDeleteFolder = async (id: string, version: number) => {
		const res = await fetch(`/api/cms/v1/folders/${id}?expectedVersion=${version}`, {
			method: "DELETE",
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message || "폴더 삭제 실패");
		}
		if (currentFolderId === id) {
			setCurrentFolderId(null);
			syncUrl({ folderId: null });
		}
		await fetchFolders();
		await fetchEntries();
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSelectPage = (selectAll: boolean) => {
		setSelectedIds(selectAll ? new Set(items.map((i) => i.id)) : new Set());
	};

	const selectedWithVersions = items
		.filter((i) => selectedIds.has(i.id))
		.map((i) => ({ id: i.id, expectedVersion: i.version }));

	const handleBulkDone = (failedIds: string[]) => {
		setSelectedIds(new Set(failedIds));
		void fetchEntries();
	};

	// Record Creation & Rename Modal State (Tag / Category / Collection)
	const [recordModal, setRecordModal] = useState<{
		mode: "create" | "rename";
		id?: string;
		title: string;
		version?: number;
	} | null>(null);

	const isRecordCollection = currentCollection === "tag" || currentCollection === "category";

	const handleCreateNew = () => {
		if (isRecordCollection) {
			setRecordModalError(null);
			setRecordModal({ mode: "create", title: "" });
			return;
		}
		router.push(`/admin/entries/new?collection=${currentCollection}` as any);
	};

	const handleRenameRecord = async (id: string, currentTitle: string, version: number) => {
		setRecordModalError(null);
		setRecordModal({ mode: "rename", id, title: currentTitle, version });
	};

	const handleRecordModalSubmit = async () => {
		if (!recordModal || !recordModal.title.trim()) return;
		const trimmed = recordModal.title.trim();
		setRecordModalError(null);

		try {
			if (recordModal.mode === "create") {
				const res = await fetch("/api/cms/v1/entries", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						collection: currentCollection,
						metadata: { title: trimmed },
						mdx: "",
					}),
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					setRecordModalError(cmsApiErrorMessage(err, "생성에 실패했습니다."));
					return;
				}
			} else if (recordModal.id && recordModal.version !== undefined) {
				const res = await fetch(`/api/cms/v1/entries/${recordModal.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						expectedVersion: recordModal.version,
						metadata: { title: trimmed },
					}),
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					setRecordModalError(cmsApiErrorMessage(err, "수정에 실패했습니다."));
					return;
				}
			}
			setRecordModal(null);
			await fetchEntries();
		} catch (err: any) {
			setRecordModalError(err.message || "처리 중 오류가 발생했습니다.");
		}
	};

	return (
		<div className="flex h-screen w-full overflow-hidden">
			<AdminSidebar
				currentCollection={currentCollection}
				currentFolderId={currentFolderId}
				folders={folders}
				onSelectCollection={(col) => {
					setCurrentCollection(col);
					setCurrentFolderId(null);
					setPage(1);
					syncUrl({ collection: col, folderId: null, page: 1 });
				}}
				onSelectFolder={(fId) => {
					setCurrentFolderId(fId);
					setPage(1);
					syncUrl({ folderId: fId, page: 1 });
				}}
				onCreateFolder={handleCreateFolder}
				onRenameFolder={handleRenameFolder}
				onDeleteFolder={handleDeleteFolder}
			/>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				<BulkBar
					selected={selectedWithVersions}
					folders={folders}
					onClearSelection={() => setSelectedIds(new Set())}
					onDone={handleBulkDone}
				/>
				<AdminEntriesTable
					collection={currentCollection}
					columnSettings={columnSettings[currentCollection]}
					onColumnSettingsChange={saveColumnSettings}
					items={items}
					selectedIds={selectedIds}
					onToggleSelect={toggleSelect}
					onToggleSelectPage={toggleSelectPage}
					total={total}
					page={page}
					pageSize={pageSize}
					search={search}
					statusFilter={statusFilter}
					sortField={sortField}
					sortDirection={sortDirection}
					isLoading={isLoading}
					errorMessage={errorMessage}
					onSearchChange={handleSearchChange}
					onStatusChange={(st) => {
						setStatusFilter(st);
						setPage(1);
						syncUrl({ status: st, page: 1 });
					}}
					onSortChange={(field) => {
						const newDir = sortField === field && sortDirection === "asc" ? "desc" : "asc";
						setSortField(field);
						setSortDirection(newDir);
						syncUrl({ sortField: field, sortDirection: newDir });
						savePreferences(pageSize, field, newDir);
					}}
					onPageChange={(p) => {
						setPage(p);
						syncUrl({ page: p });
					}}
					onPageSizeChange={(newSize) => {
						setPageSize(newSize);
						setPage(1);
						syncUrl({ pageSize: newSize, page: 1 });
						savePreferences(newSize);
					}}
					onCreateNew={handleCreateNew}
					onRenameRecord={handleRenameRecord}
					onOpenEditRecord={(item) => {
						setRecordModalError(null);
						setRecordModal({
							mode: "rename",
							id: item.id,
							title: item.title || "",
							version: item.version,
						});
					}}
					onRetry={fetchEntries}
					currentFolderId={currentFolderId}
					folders={folders}
					onSelectFolder={(fId) => {
						setCurrentFolderId(fId);
						setPage(1);
						syncUrl({ folderId: fId, page: 1 });
					}}
					onCreateFolder={handleCreateFolder}
					onRenameFolder={handleRenameFolder}
					onDeleteFolder={handleDeleteFolder}
				/>
			</div>

			<Dialog open={Boolean(recordModal)} onOpenChange={(open) => !open && setRecordModal(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>
							{recordModal?.mode === "create"
								? `새 ${currentCollection === "tag" ? "태그" : "카테고리"} 만들기`
								: `${currentCollection === "tag" ? "태그" : "카테고리"} 이름 수정`}
						</DialogTitle>
						<DialogDescription>
							{recordModal?.mode === "create"
								? "목록 및 글 작성 시 선택할 수 있는 이름을 입력하세요."
								: "이름을 변경하면 이 레코드를 참조하는 글들의 표시명이 즉시 갱신됩니다."}
						</DialogDescription>
					</DialogHeader>
					<label htmlFor="record-title" className="sr-only">
						이름
					</label>
					<input
						id="record-title"
						type="text"
						autoFocus
						value={recordModal?.title ?? ""}
						onChange={(e) => recordModal && setRecordModal({ ...recordModal, title: e.target.value })}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleRecordModalSubmit();
							}
						}}
						placeholder="이름 입력 (예: TypeScript)"
						className="w-full rounded-md border bg-background px-3 py-2 text-sm"
					/>
					{recordModalError && (
						<p role="alert" className="whitespace-pre-wrap text-destructive text-sm">
							{recordModalError}
						</p>
					)}
					<DialogFooter>
						<button type="button" onClick={() => setRecordModal(null)} className="rounded-md border px-3 py-2 text-sm">
							취소
						</button>
						<button
							type="button"
							disabled={!recordModal?.title.trim()}
							onClick={handleRecordModalSubmit}
							className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
						>
							{recordModal?.mode === "create" ? "생성" : "수정 완료"}
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
