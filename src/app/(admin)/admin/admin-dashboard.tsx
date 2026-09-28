"use client";

import { Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import type { AdminColumnSettings, CollectionPreferences, PreferencesBody } from "@/cms/core/api";
import { COLLECTION_DEFINITIONS, COLLECTIONS, isRecordCollection } from "@/cms/core/collections";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "./admin-api";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar, type BulkItemResult, type BulkSelection, describeBulkFailure, runBulk } from "./entries/bulk-bar";
import {
	isExplorerMode,
	type ListState,
	listStateToApiQuery,
	listStateToSearchParams,
	parseListState,
} from "./list-state";
import { FilterChipBar, ListSearch } from "./list-toolbar";
import { RecordDialog, type RecordTarget } from "./record-dialog";
import type { MenuAction } from "./shared/action-menu";
import { AdminNavProvider, AdminShell, useAdminNav } from "./shared/admin-shell";
import { ConfirmDialog, type ConfirmRequest } from "./shared/confirm-dialog";
import type { DraggedEntry } from "./shared/entry-drag";
import { useFolderActions } from "./shared/use-folder-actions";
import { useTaxonomy } from "./shared/use-taxonomy";

type Mode = "list" | "trash";

const toSelection = (item: ListEntriesItem): BulkSelection => ({
	id: item.id,
	expectedVersion: item.version,
	title: item.title,
});

/** 일괄 결과를 알림으로 알린다. 실패는 항목 이름과 사유를 적는다. */
function announce(label: string, results: BulkItemResult[], items: BulkSelection[]) {
	const failures = results.filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const ok = results.length - failures.length;
	if (failures.length === 0) {
		toast.success(`${ok}개 항목을 ${label}했습니다.`);
		return;
	}
	const titleOf = (id: string) => items.find((item) => item.id === id)?.title || "제목 없음";
	toast.error(ok > 0 ? `${ok}개는 ${label}했고 ${failures.length}개는 하지 못했습니다.` : `${label}하지 못했습니다.`, {
		description: failures
			.slice(0, 3)
			.map((failure) => `${titleOf(failure.id)} — ${describeBulkFailure(failure)}`)
			.join("\n"),
	});
}

/** 목록·휴지통 화면의 상태·데이터·작업. 셸(사이드바 폴더 탐색)과 본문이 함께 쓴다. */
function useDashboard(mode: Mode) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { refreshTrashCount } = useAdminNav();
	const isTrash = mode === "trash";
	const basePath = isTrash ? "/admin/trash" : "/admin";
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
	const isRecord = isRecordCollection(collection);
	const isContent = collection === "post" || collection === "memo";

	const [items, setItems] = useState<ListEntriesItem[]>([]);
	const [total, setTotal] = useState(0);
	const [folders, setFolders] = useState<Folder[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const tags = useTaxonomy("tag", isContent);
	const categories = useTaxonomy("category", collection === "post");
	const options = useMemo(
		() => ({ tags: tags.options, categories: categories.options }),
		[tags.options, categories.options],
	);

	const navigate = useCallback(
		(next: ListState) =>
			router.replace(`${basePath}?${listStateToSearchParams(next).toString()}` as Route, { scroll: false }),
		[router, basePath],
	);
	const update = useCallback(
		(patch: Partial<ListState>, options: { resetPage?: boolean } = { resetPage: true }) =>
			navigate({ ...state, ...(options.resetPage ? { page: 1 } : {}), ...patch }),
		[navigate, state],
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
			() => toast.error("목록 설정을 저장하지 못했습니다."),
		);
	};

	const fetchFolders = useCallback(async () => {
		if (isTrash) return;
		try {
			setFolders(await cmsFetch<Folder[]>(`/api/cms/v1/folders?collection=${collection}`));
		} catch {
			setFolders([]);
		}
	}, [collection, isTrash]);

	const apiQuery = listStateToApiQuery(state, { trash: isTrash }).toString();
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

	const refresh = async (failedIds: string[] = []) => {
		setSelectedIds(new Set(failedIds));
		await fetchEntries();
		refreshTrashCount();
	};

	const folderActions = useFolderActions({
		collection,
		folders,
		onChanged: async (deletedId) => {
			await fetchFolders();
			if (deletedId && state.folder === deletedId) update({ folder: "all" });
			else await fetchEntries();
		},
	});

	const bulk = async (
		op: Parameters<typeof runBulk>[0],
		label: string,
		targets: BulkSelection[],
		params: Parameters<typeof runBulk>[2] = {},
	) => {
		try {
			const results = await runBulk(op, targets, params);
			announce(label, results, targets);
			await refresh(results.filter((result) => !result.ok).map((result) => result.id));
		} catch (error) {
			toast.error(errorText(error, `${label}하지 못했습니다.`));
		}
	};

	const moveEntries = (folderId: string | null, entries: DraggedEntry[]) =>
		void bulk(
			"folder.move",
			"옮김",
			entries.map((entry) => ({ ...entry, title: items.find((item) => item.id === entry.id)?.title })),
			{ folderId },
		);

	const restore = async (targets: BulkSelection[]) => {
		const results: BulkItemResult[] = [];
		for (const target of targets) {
			try {
				await cmsFetch(`/api/cms/v1/entries/${target.id}/restore`, {
					method: "POST",
					json: { expectedVersion: target.expectedVersion },
				});
				results.push({ id: target.id, ok: true, version: target.expectedVersion + 1 });
			} catch (error) {
				const code = (error as { code?: string }).code ?? "internal";
				results.push({ id: target.id, ok: false, error: code });
			}
		}
		announce("복원", results, targets);
		await refresh(results.filter((result) => !result.ok).map((result) => result.id));
	};

	const confirmTrash = (targets: BulkSelection[]) =>
		setConfirm({
			title: `휴지통으로 이동 — ${targets.length}개`,
			description:
				targets.length === 1
					? `'${targets[0]?.title || "제목 없음"}'을(를) 휴지통으로 옮깁니다. 공개가 종료되고 예약이 취소됩니다.`
					: "선택한 항목을 휴지통으로 옮깁니다. 공개가 종료되고 예약이 취소됩니다.",
			confirmLabel: "휴지통으로 이동",
			destructive: true,
			onConfirm: () => bulk("trash", "휴지통으로 이동", targets),
		});

	const confirmPermanentDelete = (targets: BulkSelection[]) =>
		setConfirm({
			title: `영구 삭제 — ${targets.length}개`,
			description:
				targets.length === 1
					? `'${targets[0]?.title || "제목 없음"}'을(를) 영구 삭제합니다. 되돌릴 수 없습니다.`
					: "선택한 항목을 영구 삭제합니다. 되돌릴 수 없습니다. 다른 콘텐츠가 쓰는 항목은 지우지 않고 사유를 보여 줍니다.",
			confirmLabel: "영구 삭제",
			destructive: true,
			onConfirm: () => bulk("permanentDelete", "영구 삭제", targets),
		});

	const duplicate = async (item: ListEntriesItem) => {
		try {
			const copy = await cmsFetch<{ id: string }>(`/api/cms/v1/entries/${item.id}/duplicate`, {
				method: "POST",
				fallback: "복제하지 못했습니다.",
			});
			toast.success(`'${item.title || "제목 없음"}'을(를) 복제했습니다.`);
			router.push(`/admin/entries/${copy.id}/edit` as Route);
		} catch (error) {
			toast.error(errorText(error, "복제하지 못했습니다."));
		}
	};

	const createNew = () =>
		isRecord
			? setRecordTarget({ collection, id: null })
			: router.push(
					`/admin/entries/new?collection=${collection}${state.folder !== "all" ? `&folder=${state.folder}` : ""}` as Route,
				);

	/** 행 메뉴(v2 A2). 선택한 행을 오른쪽 클릭하면 선택 전체를 대상으로 한다. */
	const rowMenu = (item: ListEntriesItem): MenuAction[] => {
		const group =
			selectedIds.has(item.id) && selectedIds.size > 1 ? items.filter((row) => selectedIds.has(row.id)) : [item];
		const targets = group.map(toSelection);
		const single = group.length === 1;
		const header: MenuAction[] = single ? [] : [{ kind: "label", label: `${group.length}개 항목` }];

		if (isTrash) {
			return [
				...header,
				{ kind: "item", label: "복원", onSelect: () => void restore(targets) },
				{ kind: "separator" },
				{
					kind: "item",
					label: "영구 삭제",
					shortcut: "Del",
					destructive: true,
					onSelect: () => confirmPermanentDelete(targets),
				},
			];
		}

		const editHref = `/admin/entries/${item.id}/edit`;
		const open: MenuAction[] = single
			? isRecord
				? [{ kind: "item", label: "열기", onSelect: () => setRecordTarget({ collection, id: item.id }) }]
				: [
						{ kind: "item", label: "열기", onSelect: () => router.push(editHref as Route) },
						{ kind: "item", label: "새 탭에서 열기", onSelect: () => window.open(editHref, "_blank", "noopener") },
						{ kind: "item", label: "복제", onSelect: () => void duplicate(item) },
					]
			: [];
		const allArchived = group.every((row) => row.status === "archived");
		return [
			...header,
			...open,
			{ kind: "separator" },
			{
				kind: "sub",
				label: "폴더로 이동",
				items: [
					{
						kind: "item",
						label: "최상위",
						onSelect: () => void bulk("folder.move", "옮김", targets, { folderId: null }),
					},
					...folders.map((folder) => ({
						kind: "item" as const,
						label: folder.name,
						onSelect: () => void bulk("folder.move", "옮김", targets, { folderId: folder.id }),
					})),
				],
			},
			...(isContent
				? [
						{
							kind: "sub" as const,
							label: "태그 추가",
							emptyLabel: "태그가 없습니다",
							items: tags.options.map((tag) => ({
								kind: "item" as const,
								label: tag.title,
								onSelect: () => void bulk("tags.add", "태그를 추가", targets, { tagIds: [tag.id] }),
							})),
						},
						{ kind: "separator" as const },
						allArchived
							? {
									kind: "item" as const,
									label: "보관 해제",
									onSelect: () => void bulk("unarchive", "보관 해제", targets),
								}
							: { kind: "item" as const, label: "보관", onSelect: () => void bulk("archive", "보관", targets) },
					]
				: [{ kind: "separator" as const }]),
			{
				kind: "item",
				label: "휴지통으로",
				shortcut: "Del",
				destructive: true,
				onSelect: () => confirmTrash(targets),
			},
		];
	};

	const onDeleteKey = (item: ListEntriesItem) => {
		const group =
			selectedIds.has(item.id) && selectedIds.size > 1 ? items.filter((row) => selectedIds.has(row.id)) : [item];
		if (isTrash) confirmPermanentDelete(group.map(toSelection));
		else confirmTrash(group.map(toSelection));
	};

	const explorer =
		!isTrash && isExplorerMode(state)
			? (() => {
					const current = state.folder === "all" ? null : state.folder;
					const currentFolder = current ? folders.find((folder) => folder.id === current) : undefined;
					return {
						folders: folders.filter((folder) => (folder.parentId ?? null) === current),
						parent: current ? (currentFolder?.parentId ?? "all") : null,
					};
				})()
			: null;

	const columnSettings = collectionPrefs.columns;
	const label = COLLECTION_DEFINITIONS[collection].label;

	const headerActions = (
		<>
			<ListSearch state={state} onChange={update} allowBody={!isTrash} />
			{!isTrash && (
				<Button type="button" size="sm" onClick={createNew}>
					<Plus aria-hidden />새 {label}
				</Button>
			)}
		</>
	);

	const body = (
		<>
			<FilterChipBar state={state} options={options} onChange={update} />
			<BulkBar
				collection={collection}
				mode={mode}
				selected={items.filter((item) => selectedIds.has(item.id)).map(toSelection)}
				folders={folders}
				onClearSelection={() => setSelectedIds(new Set())}
				onDone={(failedIds) => void refresh(failedIds)}
			/>
			<AdminEntriesTable
				collection={collection}
				items={items}
				folders={folders}
				explorer={explorer}
				state={state}
				options={options}
				onStateChange={(patch) => {
					update(patch);
					if (patch.sortField || patch.sortDirection) {
						savePreferences({
							sort: {
								field: patch.sortField ?? state.sortField,
								direction: patch.sortDirection ?? state.sortDirection,
							},
						});
					}
				}}
				columnSettings={columnSettings}
				onColumnSettingsChange={(columns: AdminColumnSettings) => savePreferences({ columns })}
				selectedIds={selectedIds}
				onSelectionChange={setSelectedIds}
				total={total}
				isLoading={isLoading}
				errorMessage={errorMessage}
				mode={mode}
				folderActions={isTrash ? undefined : folderActions}
				rowMenu={rowMenu}
				blankMenu={
					isTrash
						? undefined
						: [
								{
									kind: "item",
									label: "새 폴더",
									onSelect: () => folderActions.requestCreate(state.folder === "all" ? null : state.folder),
								},
								{ kind: "item", label: `새 ${label}`, onSelect: createNew },
							]
				}
				onDeleteKey={onDeleteKey}
				onSelectFolder={(folder) => update({ folder })}
				onOpenRecord={(item) => setRecordTarget({ collection, id: item.id })}
				onRestore={(item) => void restore([toSelection(item)])}
				onPermanentDelete={(item) => confirmPermanentDelete([toSelection(item)])}
				onPageChange={(page) => update({ page }, { resetPage: false })}
				onPageSizeChange={(pageSize) => {
					update({ pageSize });
					savePreferences({ pageSize });
				}}
				onRetry={() => void fetchEntries()}
			/>
			{folderActions.dialogs}
			<RecordDialog
				target={recordTarget}
				onClose={() => setRecordTarget(null)}
				onSaved={() => {
					setRecordTarget(null);
					toast.success("저장했습니다. 공개 분류 정보에 반영되었습니다.");
					void fetchEntries();
					void tags.reload();
					void categories.reload();
				}}
			/>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</>
	);

	return { body, headerActions, total, state, folders, folderActions, moveEntries, update, createNew, label };
}

// 관리자 목록은 브라우저에서 데이터를 가져온다. hydration 뒤에 그려야 Base UI의 자동 ID가 서버 HTML과 어긋나지 않는다.
function useDashboardMounted() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}

function DashboardLoading() {
	return (
		<output className="flex h-svh items-center justify-center text-muted-foreground text-sm">
			관리자 화면을 불러오는 중…
		</output>
	);
}

/** 목록 화면(§3.1·§3.2). 별도 통계 대시보드 없이 컬렉션 목록을 연다. */
export function AdminClientDashboard() {
	const mounted = useDashboardMounted();
	if (!mounted) return <DashboardLoading />;

	return (
		<AdminNavProvider>
			<ListPage />
		</AdminNavProvider>
	);
}

/** 휴지통 전용 화면(v2 A3). 컬렉션 탭으로 나누고 복원·영구 삭제만 제공한다. */
export function AdminTrashDashboard() {
	const mounted = useDashboardMounted();
	if (!mounted) return <DashboardLoading />;

	return (
		<AdminNavProvider>
			<TrashPage />
		</AdminNavProvider>
	);
}

function TrashPage() {
	const { body, state, total, headerActions } = useDashboard("trash");
	return (
		<AdminShell
			title="휴지통"
			count={total}
			sidebar={{ activeNav: "trash" }}
			headerActions={
				<>
					{headerActions}
					<nav aria-label="휴지통 컬렉션" className="flex items-center gap-1 rounded-lg bg-muted p-[3px]">
						{COLLECTIONS.map((item) => (
							<Link
								key={item}
								href={`/admin/trash?collection=${item}` as Route}
								aria-current={state.collection === item ? "page" : undefined}
								className={cn(
									buttonVariants({ variant: "ghost", size: "xs" }),
									"text-muted-foreground aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm",
								)}
							>
								{COLLECTION_DEFINITIONS[item].label}
							</Link>
						))}
					</nav>
				</>
			}
		>
			{body}
		</AdminShell>
	);
}

function ListPage() {
	const { state, folders, folderActions, moveEntries, update, createNew, label, body, headerActions, total } =
		useDashboard("list");
	const folderLabel =
		state.folder !== "all" ? ` · ${folders.find((folder) => folder.id === state.folder)?.name ?? ""}` : "";
	return (
		<AdminShell
			title={`${label}${folderLabel}`}
			count={total}
			headerActions={headerActions}
			sidebar={{
				activeNav: state.collection,
				folderNav: {
					collection: state.collection,
					currentFolder: state.folder,
					includeDescendants: state.includeDescendants,
					folders,
					folderActions,
					onSelectFolder: (folder) => update({ folder }),
					onIncludeDescendantsChange: (includeDescendants) => update({ includeDescendants }),
					onDropEntries: moveEntries,
					onCreateEntry: createNew,
				},
			}}
		>
			{body}
		</AdminShell>
	);
}
