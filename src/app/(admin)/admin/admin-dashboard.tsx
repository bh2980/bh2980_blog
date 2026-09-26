"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import type { AdminColumnSettings, CollectionPreferences, ListSortField, PreferencesBody } from "@/cms/core/api";
import { type Collection, isRecordCollection } from "@/cms/core/collections";
import { cmsFetch, errorText } from "./admin-api";
import { AdminEntriesTable } from "./admin-entries-table";
import { AdminMobileNavigation } from "./admin-mobile-navigation";
import { AdminSidebar } from "./admin-sidebar";
import { BulkBar } from "./entries/bulk-bar";
import { ListFilters } from "./list-filters";
import {
	isExplorerMode,
	type ListState,
	listStateToApiQuery,
	listStateToSearchParams,
	parseListState,
} from "./list-state";
import { RecordDialog, type RecordTarget } from "./record-dialog";
import { ConfirmDialog, type ConfirmRequest } from "./shared/confirm-dialog";
import type { DraggedEntry } from "./shared/entry-drag";
import { useFolderActions } from "./shared/use-folder-actions";
import { useTaxonomy } from "./shared/use-taxonomy";

/** 목록 화면(§3.1·§3.2). 별도 통계 대시보드 없이 컬렉션 목록을 연다. */
export function AdminClientDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const parsed = useMemo(() => parseListState(new URLSearchParams(searchParams.toString())), [searchParams]);
	const [preferences, setPreferences] = useState<PreferencesBody | null>(null);

	// URL에 페이지 크기·정렬이 없으면 컬렉션별 저장 설정을 쓴다(§3.2).
	const collectionPrefs: CollectionPreferences = preferences?.collections?.[parsed.collection] ?? {};
	const state: ListState = useMemo(
		() => ({
			...parsed,
			pageSize: parsed.explicit.pageSize ? parsed.pageSize : (collectionPrefs.pageSize ?? parsed.pageSize),
			sortField: parsed.explicit.sort ? parsed.sortField : (collectionPrefs.sort?.field ?? parsed.sortField),
			sortDirection: parsed.explicit.sort
				? parsed.sortDirection
				: (collectionPrefs.sort?.direction ?? parsed.sortDirection),
		}),
		[parsed, collectionPrefs],
	);
	const collection = state.collection;

	const [items, setItems] = useState<ListEntriesItem[]>([]);
	const [total, setTotal] = useState(0);
	const [folders, setFolders] = useState<Folder[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const tags = useTaxonomy("tag", collection === "post" || collection === "memo");
	const categories = useTaxonomy("category", collection === "post");

	const update = useCallback(
		(patch: Partial<ListState>, options: { resetPage?: boolean } = { resetPage: true }) => {
			const next = { ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch };
			router.replace(`?${listStateToSearchParams(next).toString()}`, { scroll: false });
		},
		[router, state],
	);

	useEffect(() => {
		cmsFetch<PreferencesBody>("/api/cms/v1/preferences")
			.then(setPreferences)
			.catch(() => setPreferences({}));
	}, []);

	const savePreferences = (patch: CollectionPreferences) => {
		setPreferences((current) => ({
			...current,
			collections: { ...current?.collections, [collection]: { ...current?.collections?.[collection], ...patch } },
		}));
		void cmsFetch("/api/cms/v1/preferences", { method: "PUT", json: { collections: { [collection]: patch } } }).catch(
			() => {
				setFeedback("목록 설정을 저장하지 못했습니다.");
			},
		);
	};

	const fetchFolders = useCallback(async () => {
		try {
			setFolders(await cmsFetch<Folder[]>(`/api/cms/v1/folders?collection=${collection}`));
		} catch {
			setFolders([]);
		}
	}, [collection]);

	const apiQuery = listStateToApiQuery(state).toString();
	const abortRef = useRef<AbortController | null>(null);
	const fetchEntries = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await cmsFetch<{ items: ListEntriesItem[]; total: number }>(`/api/cms/v1/entries?${apiQuery}`, {
				signal: controller.signal,
				fallback: "목록을 불러오지 못했습니다.",
			});
			setItems(data.items);
			setTotal(data.total);
		} catch (error) {
			if ((error as Error).name !== "AbortError") setErrorMessage(errorText(error, "목록을 불러오지 못했습니다."));
		} finally {
			if (abortRef.current === controller) setIsLoading(false);
		}
	}, [apiQuery]);

	useEffect(() => {
		void fetchFolders();
	}, [fetchFolders]);
	useEffect(() => {
		void fetchEntries();
	}, [fetchEntries]);
	// 전체 선택은 현재 페이지만 대상이다(§3.4). 목록이 바뀌면 선택을 비운다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the visible query changes
	useEffect(() => setSelectedIds(new Set()), [apiQuery]);

	const folderActions = useFolderActions({
		collection,
		folders,
		onChanged: async (deletedId) => {
			await fetchFolders();
			if (deletedId && state.folder === deletedId) update({ folder: "all" });
			else await fetchEntries();
		},
	});

	const moveEntries = async (folderId: string | null, entries: DraggedEntry[]) => {
		try {
			const data = await cmsFetch<{ results: { ok: boolean }[] }>("/api/cms/v1/bulk", {
				method: "POST",
				json: { op: "folder.move", items: entries, folderId },
			});
			const failed = data.results.filter((result) => !result.ok).length;
			setFeedback(
				failed
					? `${entries.length - failed}개를 옮기고 ${failed}개는 옮기지 못했습니다.`
					: `${entries.length}개를 옮겼습니다.`,
			);
			await fetchEntries();
		} catch (error) {
			setFeedback(errorText(error, "폴더로 옮기지 못했습니다."));
		}
	};

	const restore = async (item: ListEntriesItem) => {
		try {
			await cmsFetch(`/api/cms/v1/entries/${item.id}/restore`, {
				method: "POST",
				json: { expectedVersion: item.version },
			});
			setFeedback(`'${item.title ?? "제목 없음"}'을(를) 복원했습니다.`);
			await fetchEntries();
		} catch (error) {
			setFeedback(errorText(error, "복원하지 못했습니다."));
		}
	};

	const requestPermanentDelete = (item: ListEntriesItem) =>
		setConfirm({
			title: "영구 삭제",
			description: `'${item.title ?? "제목 없음"}'을(를) 영구 삭제합니다. 되돌릴 수 없습니다.`,
			confirmLabel: "영구 삭제",
			destructive: true,
			onConfirm: async () => {
				try {
					await cmsFetch(`/api/cms/v1/entries/${item.id}?expectedVersion=${item.version}`, { method: "DELETE" });
					setFeedback("영구 삭제했습니다.");
					await fetchEntries();
				} catch (error) {
					setFeedback(errorText(error, "삭제하지 못했습니다."));
				}
			},
		});

	const selectCollection = (next: Collection) => router.replace(`?collection=${next}`, { scroll: false });

	const explorer = isExplorerMode(state)
		? (() => {
				const current = state.folder === "all" ? null : state.folder;
				const currentFolder = current ? folders.find((folder) => folder.id === current) : undefined;
				return {
					folders: folders.filter((folder) => (folder.parentId ?? null) === current),
					parent: current ? (currentFolder?.parentId ?? "all") : null,
				};
			})()
		: null;

	const renderSidebar = (onNavigate?: () => void) => (
		<AdminSidebar
			currentCollection={collection}
			currentFolder={state.folder}
			includeDescendants={state.includeDescendants}
			folders={folders}
			folderActions={folderActions}
			onSelectCollection={selectCollection}
			onSelectFolder={(folder) =>
				update({ folder, includeDescendants: folder === "all" ? false : state.includeDescendants })
			}
			onIncludeDescendantsChange={(includeDescendants) => update({ includeDescendants })}
			onDropEntries={(folderId, entries) => void moveEntries(folderId, entries)}
			onNavigate={onNavigate}
		/>
	);

	return (
		<div className="flex h-screen w-full overflow-hidden">
			<div className="hidden lg:flex">{renderSidebar()}</div>
			<main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950">
				<header className="flex h-12 shrink-0 items-center gap-3 border-neutral-800 border-b bg-neutral-900/40 px-3 lg:hidden">
					<AdminMobileNavigation>{(close) => renderSidebar(close)}</AdminMobileNavigation>
					<span className="font-medium text-neutral-200 text-sm">CMS 관리자</span>
				</header>
				<ListFilters
					state={state}
					tags={tags.options}
					categories={categories.options}
					onChange={update}
					onCreateNew={() =>
						isRecordCollection(collection)
							? setRecordTarget({ collection, id: null })
							: router.push(
									`/admin/entries/new?collection=${collection}${state.folder !== "all" && state.folder !== "unfiled" ? `&folder=${state.folder}` : ""}`,
								)
					}
				/>
				{feedback && (
					<output className="flex items-center justify-between border-neutral-800 border-b px-6 py-2 text-neutral-200 text-sm">
						{feedback}
						<button type="button" className="text-xs underline" onClick={() => setFeedback(null)}>
							닫기
						</button>
					</output>
				)}
				<BulkBar
					collection={collection}
					selected={items
						.filter((item) => selectedIds.has(item.id))
						.map((item) => ({ id: item.id, expectedVersion: item.version, title: item.title }))}
					folders={folders}
					onClearSelection={() => setSelectedIds(new Set())}
					onDone={(failedIds) => {
						setSelectedIds(new Set(failedIds));
						void fetchEntries();
					}}
				/>
				<AdminEntriesTable
					collection={collection}
					items={items}
					folders={folders}
					explorer={explorer}
					columnSettings={collectionPrefs.columns}
					onColumnSettingsChange={(columns: AdminColumnSettings) => savePreferences({ columns })}
					selectedIds={selectedIds}
					onToggleSelect={(id) =>
						setSelectedIds((prev) => {
							const next = new Set(prev);
							if (next.has(id)) next.delete(id);
							else next.add(id);
							return next;
						})
					}
					onToggleSelectPage={(all) => setSelectedIds(all ? new Set(items.map((item) => item.id)) : new Set())}
					total={total}
					page={state.page}
					pageSize={state.pageSize}
					sortField={state.sortField}
					sortDirection={state.sortDirection}
					isLoading={isLoading}
					errorMessage={errorMessage}
					isTrashView={state.status === "trashed"}
					folderActions={folderActions}
					onSortChange={(field: ListSortField) => {
						const direction = state.sortField === field && state.sortDirection === "desc" ? "asc" : "desc";
						update({ sortField: field, sortDirection: direction });
						savePreferences({ sort: { field, direction } });
					}}
					onPageChange={(page) => update({ page }, { resetPage: false })}
					onPageSizeChange={(pageSize) => {
						update({ pageSize });
						savePreferences({ pageSize });
					}}
					onSelectFolder={(folder) => update({ folder })}
					onOpenRecord={(item) => setRecordTarget({ collection, id: item.id })}
					onRestore={(item) => void restore(item)}
					onPermanentDelete={requestPermanentDelete}
					onRetry={() => void fetchEntries()}
				/>
			</main>
			{folderActions.dialogs}
			<RecordDialog
				target={recordTarget}
				onClose={() => setRecordTarget(null)}
				onSaved={() => {
					setRecordTarget(null);
					setFeedback("저장했습니다. 공개 분류 정보에 반영되었습니다.");
					void fetchEntries();
					void tags.reload();
					void categories.reload();
				}}
			/>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</div>
	);
}
