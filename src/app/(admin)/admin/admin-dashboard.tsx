"use client";

import { useCallback, useEffect, useState } from "react";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import type { Collection } from "@/cms/services/types";
import { AdminEntriesTable } from "./admin-entries-table";
import { AdminSidebar } from "./admin-sidebar";

export function AdminClientDashboard() {
	const [currentCollection, setCurrentCollection] = useState<Collection>("post");
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [folders, setFolders] = useState<Folder[]>([]);

	const [items, setItems] = useState<ListEntriesItem[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [sortField, setSortField] = useState<"updatedAt" | "createdAt" | "title" | "slug">("updatedAt");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [isLoading, setIsLoading] = useState(false);

	// Load Preferences once on mount
	useEffect(() => {
		fetch("/api/cms/v1/preferences")
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) {
					if (data.defaultPageSize) setPageSize(data.defaultPageSize);
					if (data.sort) {
						setSortField(data.sort.field);
						setSortDirection(data.sort.direction);
					}
				}
			})
			.catch(() => {});
	}, []);

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

	// Fetch Entries
	const fetchEntries = useCallback(async () => {
		setIsLoading(true);
		try {
			const params = new URLSearchParams();
			params.set("collection", currentCollection);
			if (search) params.set("search", search);
			if (statusFilter) params.set("status", statusFilter);
			if (currentFolderId) params.set("folderId", currentFolderId);
			params.set("sortField", sortField);
			params.set("sortDirection", sortDirection);
			params.set("page", String(page));
			params.set("pageSize", String(pageSize));

			const res = await fetch(`/api/cms/v1/entries?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				setItems(data.items);
				setTotal(data.total);
			}
		} catch (err) {
			console.error("Failed to fetch entries", err);
		} finally {
			setIsLoading(false);
		}
	}, [currentCollection, currentFolderId, search, statusFilter, sortField, sortDirection, page, pageSize]);

	useEffect(() => {
		fetchFolders();
	}, [fetchFolders]);

	useEffect(() => {
		fetchEntries();
	}, [fetchEntries]);

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
			throw new Error(err.error || "폴더 생성 실패");
		}
		await fetchFolders();
	};

	const handleCreateNew = async () => {
		const title = prompt("새 항목 제목을 입력하세요:");
		if (!title) return;
		try {
			const res = await fetch("/api/cms/v1/entries", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					collection: currentCollection,
					metadata: { title },
					mdx: "",
					folderId: currentFolderId,
				}),
			});
			if (res.ok) {
				await fetchEntries();
			} else {
				const err = await res.json();
				alert("생성 실패: " + (err.error || "알 수 없는 오류"));
			}
		} catch (e) {
			alert("생성 실패: " + String(e));
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
				}}
				onSelectFolder={(fId) => {
					setCurrentFolderId(fId);
					setPage(1);
				}}
				onCreateFolder={handleCreateFolder}
			/>

			<AdminEntriesTable
				items={items}
				total={total}
				page={page}
				pageSize={pageSize}
				search={search}
				statusFilter={statusFilter}
				sortField={sortField}
				sortDirection={sortDirection}
				isLoading={isLoading}
				onSearchChange={(s) => {
					setSearch(s);
					setPage(1);
				}}
				onStatusChange={(st) => {
					setStatusFilter(st);
					setPage(1);
				}}
				onSortChange={(field) => {
					const newDir = sortField === field && sortDirection === "asc" ? "desc" : "asc";
					setSortField(field);
					setSortDirection(newDir);
					savePreferences(pageSize, field, newDir);
				}}
				onPageChange={(p) => setPage(p)}
				onPageSizeChange={(newSize) => {
					setPageSize(newSize);
					setPage(1);
					savePreferences(newSize);
				}}
				onCreateNew={handleCreateNew}
			/>
		</div>
	);
}
