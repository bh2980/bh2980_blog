"use client";

import { Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AdminColumnSettings } from "@/cms/core/api";
import { COLLECTION_DEFINITIONS, COLLECTIONS } from "@/cms/core/collections";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { AdminEntriesTable } from "./admin-entries-table";
import { BulkBar, runBulk } from "./entries/bulk-bar";
import { toSelection } from "./list-row-menu";
import { FilterChipBar, ListSearch } from "./list-toolbar";
import { RecordDialog } from "./record-dialog";
import { AdminNavProvider, AdminShell } from "./shared/admin-shell";
import { ConfirmDialog } from "./shared/confirm-dialog";
import { type EntryList, useEntryList } from "./use-entry-list";

/** 목록 위 오른쪽: 검색과 새 항목(휴지통에는 새 항목이 없다). */
function EntryListHeaderActions({ list }: { list: EntryList }) {
	const isTrash = list.mode === "trash";
	return (
		<>
			<ListSearch state={list.state} onChange={list.update} allowBody={!isTrash} />
			{!isTrash && (
				<Button type="button" size="sm" onClick={list.createNew}>
					<Plus aria-hidden />새 {list.label}
				</Button>
			)}
		</>
	);
}

/** 목록 본문: 필터 칩, 일괄 작업 줄, 표, 그리고 목록 작업이 여는 창. */
function EntryListBody({ list }: { list: EntryList }) {
	const { state, data, mode } = list;
	const isTrash = mode === "trash";
	const { items } = data;
	return (
		<>
			<FilterChipBar state={state} options={list.options} onChange={list.update} />
			<BulkBar
				collection={state.collection}
				mode={mode}
				selected={items.filter((item) => list.selectedIds.has(item.id)).map(toSelection)}
				folders={data.folders}
				onClearSelection={() => list.setSelectedIds(new Set())}
				onRun={(op, targets, params) =>
					list.mutations.mutateEntries(op, targets, () => runBulk(op, targets, params), params)
				}
			/>
			<AdminEntriesTable
				collection={state.collection}
				items={items}
				folders={data.folders}
				explorer={list.explorer}
				state={state}
				options={list.options}
				onStateChange={(patch) => {
					list.update(patch);
					if (patch.sortField || patch.sortDirection) {
						list.savePreferences({
							sort: {
								field: patch.sortField ?? state.sortField,
								direction: patch.sortDirection ?? state.sortDirection,
							},
						});
					}
				}}
				columnSettings={list.columnSettings}
				onColumnSettingsChange={(columns: AdminColumnSettings) => list.savePreferences({ columns })}
				selectedIds={list.selectedIds}
				onSelectionChange={list.setSelectedIds}
				total={data.total}
				isLoading={data.isLoading}
				isRefreshing={data.isRefreshing}
				errorMessage={data.errorMessage}
				mode={mode}
				folderActions={isTrash ? undefined : list.folderActions}
				rowMenu={list.rowMenu}
				blankMenu={
					isTrash
						? undefined
						: [
								{
									kind: "item",
									label: "새 폴더",
									onSelect: () => list.folderActions.requestCreate(state.folder === "all" ? null : state.folder),
								},
								{ kind: "item", label: `새 ${list.label}`, onSelect: list.createNew },
							]
				}
				onDeleteKey={list.onDeleteKey}
				onSelectFolder={(folder) => list.update({ folder })}
				onOpenRecord={(item) => list.setRecordTarget({ collection: state.collection, id: item.id })}
				onRestore={(item) => void list.restore([toSelection(item)])}
				onPermanentDelete={(item) => list.confirmPermanentDelete([toSelection(item)])}
				onPageChange={(page) => list.update({ page }, { resetPage: false })}
				onPageSizeChange={(pageSize) => {
					list.update({ pageSize });
					list.savePreferences({ pageSize });
				}}
				onRetry={data.retry}
			/>
			{list.folderActions.dialogs}
			<RecordDialog
				target={list.recordTarget}
				onClose={() => list.setRecordTarget(null)}
				onSaved={() => {
					list.setRecordTarget(null);
					toast.success("저장했습니다. 공개 분류 정보에 반영되었습니다.");
					void list.invalidateEntries();
					list.reloadTaxonomies();
				}}
			/>
			<ConfirmDialog request={list.confirm} onClose={list.closeConfirm} />
		</>
	);
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
	const list = useEntryList("trash");
	const { state } = list;
	return (
		<AdminShell
			title="휴지통"
			count={list.data.total}
			sidebar={{ activeNav: "trash" }}
			headerActions={
				<>
					<EntryListHeaderActions list={list} />
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
			<EntryListBody list={list} />
		</AdminShell>
	);
}

function ListPage() {
	const list = useEntryList("list");
	const { state, update } = list;
	const { folders } = list.data;
	const folderLabel =
		state.folder !== "all" ? ` · ${folders.find((folder) => folder.id === state.folder)?.name ?? ""}` : "";
	return (
		<AdminShell
			title={`${list.label}${folderLabel}`}
			count={list.data.total}
			headerActions={<EntryListHeaderActions list={list} />}
			sidebar={{
				activeNav: state.collection,
				folderNav: {
					collection: state.collection,
					currentFolder: state.folder,
					includeDescendants: state.includeDescendants,
					folders,
					folderActions: list.folderActions,
					onSelectFolder: (folder) => update({ folder }),
					onIncludeDescendantsChange: (includeDescendants) => update({ includeDescendants }),
					onDropEntries: list.moveEntries,
					onCreateEntry: list.createNew,
				},
			}}
		>
			<EntryListBody list={list} />
		</AdminShell>
	);
}
