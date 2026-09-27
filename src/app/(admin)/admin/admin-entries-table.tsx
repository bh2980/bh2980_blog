"use client";

import {
	type ColumnOrderState,
	type ColumnSizingState,
	type ColumnVisibilityState,
	columnOrderingFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createColumnHelper,
	type RowSelectionState,
	rowSelectionFeature,
	tableFeatures,
	type Updater,
	useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Folder as FolderIcon, FolderUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Fragment, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Folder, ListEntriesItem } from "@/cms/adapters/postgres/content-store";
import { type AdminColumnSettings, type AdminListColumn, PAGE_SIZES, type PageSize } from "@/cms/core/api";
import { isRecordCollection } from "@/cms/core/collections";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/utils/cn";
import { folderKeyHandler } from "./admin-sidebar";
import { ColumnHeader } from "./column-header";
import { COLUMN_CONFIG, COLUMN_LABELS, columnsFor, filterFor } from "./list-columns";
import type { ListState } from "./list-state";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { writeDraggedEntries } from "./shared/entry-drag";
import { describeEntryStatus } from "./shared/entry-status";
import { FittingTags } from "./shared/fitting-tags";
import { type FolderActions, folderMenuActions } from "./shared/use-folder-actions";
import type { TaxonomyOption } from "./shared/use-taxonomy";

export { COLUMN_LABELS, columnsFor };

// Data Table(v2 A1): 컬럼 표시·순서와 행 선택은 TanStack Table이 다루고, 검색·정렬·필터·페이지는 서버가 처리한다.
const features = tableFeatures({
	columnVisibilityFeature,
	columnOrderingFeature,
	columnSizingFeature,
	columnResizingFeature,
	rowSelectionFeature,
});

/** 기본 열 너비(px). 제목은 정하지 않으면 남는 폭을 채운다. 끌어서 바꾸면 그 값을 저장한다. */
const DEFAULT_COLUMN_SIZE: Partial<Record<string, number>> = {
	status: 132,
	category: 112,
	tags: 200,
	updatedAt: 132,
	publishedAt: 132,
	createdAt: 132,
	slug: 200,
	folder: 140,
};
const DEFAULT_TITLE_SIZE = 320;
const MIN_COLUMN_SIZE = 72;
const MAX_COLUMN_SIZE = 960;
const helper = createColumnHelper<typeof features, ListEntriesItem>();

/** 목록 날짜: 올해는 `9월 27일 14:05`, 그 밖은 `2025. 8. 7.`처럼 짧게 쓴다. 정확한 시각은 툴팁 대신 편집 화면에 있다. */
const formatDate = (value: Date | string | null) => {
	if (!value) return "—";
	const date = new Date(value);
	const sameYear = date.getFullYear() === new Date().getFullYear();
	return sameYear
		? date.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
		: date.toLocaleDateString("ko-KR");
};

/**
 * 폭이 모자랄 때 먼저 숨기는 컬럼과 그 순서. 사용자가 켠 컬럼이라도 제목이 최소 너비를 못 받으면 이 순서로 숨긴다.
 * 제목·상태·카테고리·수정일은 숨기지 않는다.
 */
const HIDE_ORDER_WHEN_NARROW = ["folder", "slug", "createdAt", "publishedAt", "tags"] as const;
const TITLE_MIN_WIDTH = 240;

/**
 * 열 너비 조절 손잡이. 헤더 오른쪽 가장자리를 끌거나, 초점을 두고 ←/→로 16px씩 바꾼다. 두 번 누르면 기본 너비로 돌아간다.
 */
function ColumnResizeHandle({
	label,
	width,
	resizing,
	onStart,
	onNudge,
	onReset,
}: {
	label: string;
	width: number;
	resizing: boolean;
	onStart: (event: unknown) => void;
	onNudge: (delta: number) => void;
	onReset: () => void;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: 열 너비 조절은 hr가 아니라 조작 가능한 분리자다
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={`${label} 열 너비 조절`}
			aria-valuenow={width}
			aria-valuemin={MIN_COLUMN_SIZE}
			aria-valuemax={MAX_COLUMN_SIZE}
			aria-valuetext={`${width}px`}
			tabIndex={0}
			onMouseDown={onStart}
			onTouchStart={onStart}
			onDoubleClick={onReset}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
					event.preventDefault();
					onNudge(event.key === "ArrowLeft" ? -16 : 16);
				}
			}}
			className="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none justify-center outline-none"
		>
			<span
				className={cn(
					"h-full w-px bg-transparent transition-colors group-hover/th:bg-border",
					resizing && "bg-primary group-hover/th:bg-primary",
					"[div:focus-visible>&]:bg-ring",
				)}
			/>
		</div>
	);
}

/** 상태를 아이콘 모양과 글자로 함께 보여 준다(색만으로 전달하지 않는다, §3.2). */
function StatusLabel({ item, isRecord }: { item: ListEntriesItem; isRecord: boolean }) {
	const label = isRecord && item.status === "published" ? "활성" : describeEntryStatus(item);
	const tone = item.scheduledAt
		? "text-primary"
		: item.status === "published"
			? item.hasUnpublishedChanges
				? "text-amber-600 dark:text-amber-400"
				: "text-emerald-600 dark:text-emerald-400"
			: "text-muted-foreground";
	const icon = item.scheduledAt ? (
		<>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M8 5.5V8l1.8 1.1" />
		</>
	) : item.status === "published" ? (
		item.hasUnpublishedChanges ? (
			<>
				<circle cx="8" cy="8" r="5.5" />
				<path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" />
			</>
		) : (
			<circle cx="8" cy="8" r="5.5" fill="currentColor" stroke="none" />
		)
	) : item.status === "archived" || item.status === "trashed" ? (
		<>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M5 8h6" />
		</>
	) : (
		<circle cx="8" cy="8" r="5.5" strokeDasharray="2.4 2.4" />
	);
	return (
		<span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground/80">
			<svg
				aria-hidden="true"
				focusable="false"
				viewBox="0 0 16 16"
				className={cn("size-3.5 shrink-0", tone)}
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			>
				{icon}
			</svg>
			{label}
		</span>
	);
}
const resolve = <T,>(updater: Updater<T>, current: T): T =>
	typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;

interface TableProps {
	collection: string;
	items: ListEntriesItem[];
	folders: Folder[];
	/** 폴더 탐색 모드에서 목록 위에 보여 줄 하위 폴더와 상위 폴더 이동. */
	explorer: { folders: Folder[]; parent: string | null } | null;
	state: ListState;
	options: { tags: TaxonomyOption[]; categories: TaxonomyOption[] };
	onStateChange: (patch: Partial<ListState>) => void;
	columnSettings?: AdminColumnSettings;
	onColumnSettingsChange: (settings: AdminColumnSettings) => void;
	selectedIds: Set<string>;
	onSelectionChange: (ids: Set<string>) => void;
	total: number;
	isLoading: boolean;
	errorMessage: string | null;
	/** `trash`면 휴지통 화면이다(v2 A3): 끌어 옮기기·폴더 탐색이 없고 행마다 복원·영구 삭제를 보여 준다. */
	mode?: "list" | "trash";
	folderActions?: FolderActions;
	/** 행의 오른쪽 클릭·`⋯` 메뉴(v2 A2). 선택한 행이면 선택 전체를 대상으로 한다. */
	rowMenu: (item: ListEntriesItem) => MenuAction[];
	/** 목록 빈 곳의 오른쪽 클릭 메뉴. */
	blankMenu?: MenuAction[];
	/** 행에서 Delete 키. 목록은 휴지통 이동, 휴지통은 영구 삭제를 묻는다. */
	onDeleteKey?: (item: ListEntriesItem) => void;
	onSelectFolder: (folder: string) => void;
	onOpenRecord: (item: ListEntriesItem) => void;
	onRestore?: (item: ListEntriesItem) => void;
	onPermanentDelete?: (item: ListEntriesItem) => void;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: PageSize) => void;
	onRetry: () => void;
}

export function AdminEntriesTable({
	collection,
	items,
	folders,
	explorer,
	state,
	options,
	onStateChange,
	columnSettings,
	onColumnSettingsChange,
	selectedIds,
	onSelectionChange,
	total,
	isLoading,
	errorMessage,
	mode = "list",
	folderActions,
	rowMenu,
	blankMenu,
	onDeleteKey,
	onSelectFolder,
	onOpenRecord,
	onRestore,
	onPermanentDelete,
	onPageChange,
	onPageSizeChange,
	onRetry,
}: TableProps) {
	const isTrash = mode === "trash";
	const isRecord = isRecordCollection(collection);
	const { available, defaults } = columnsFor(collection);
	const savedOrder = (columnSettings?.order ?? []).filter((column) => available.includes(column));
	const order = [...new Set([...savedOrder, ...defaults, ...available])];
	const visibility: ColumnVisibilityState = Object.fromEntries(
		available.map((column) => [
			column,
			column === "title" || (columnSettings?.visibility?.[column] ?? defaults.includes(column)),
		]),
	);
	const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
	/** `상위 / 하위`처럼 최상위부터의 폴더 경로. 폴더 밖 항목은 `—`. */
	const folderName = (id: string | null) => {
		const names: string[] = [];
		let folder = id ? folders.find((candidate) => candidate.id === id) : undefined;
		while (folder && names.length < 8) {
			names.unshift(folder.name);
			const parentId = folder.parentId;
			folder = parentId ? folders.find((candidate) => candidate.id === parentId) : undefined;
		}
		return names.length > 0 ? names.join(" / ") : "—";
	};
	// 폴더 구분 없이 평평하게 볼 때(검색·필터·하위 폴더 포함) 폴더 컬럼이 꺼져 있으면 제목 옆에 폴더 경로를 작게 붙인다.
	const showFolderBesideTitle = !explorer && !isTrash && !isRecord && folders.length > 0 && visibility.folder === false;

	// TanStack Table은 컬럼 정의가 렌더마다 새로 만들어지지 않기를 기대한다. 셀이 읽는 값이 바뀔 때만 다시 만든다.
	const availableKey = available.join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: `availableKey`가 `available`의 내용을 대신한다
	const columns = useMemo(() => {
		const cell = (item: ListEntriesItem, column: AdminListColumn) => {
			switch (column) {
				case "title": {
					const title = item.title || <span className="text-muted-foreground italic">제목 없음</span>;
					if (isTrash) return <span className="font-medium">{title}</span>;
					return isRecord ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							onClick={() => onOpenRecord(item)}
							className="h-auto p-0 font-medium text-foreground hover:text-primary"
						>
							{title}
						</Button>
					) : (
						<span className="flex min-w-0 items-center gap-2">
							<Link
								href={`/admin/entries/${item.id}/edit` as Route}
								className="truncate font-medium text-foreground hover:text-primary"
							>
								{title}
							</Link>
							{showFolderBesideTitle && item.folderId && (
								<span className="flex min-w-0 shrink items-center gap-1 text-muted-foreground text-xs">
									<FolderIcon aria-hidden className="size-3 shrink-0" />
									<span className="truncate">
										<span className="sr-only">폴더: </span>
										{folderName(item.folderId)}
									</span>
								</span>
							)}
						</span>
					);
				}
				case "status":
					// 색상만으로 상태를 전달하지 않는다(§3.2).
					return <StatusLabel item={item} isRecord={isRecord} />;
				case "category":
					return item.category?.title ?? <span className="text-muted-foreground">—</span>;
				case "tags":
					if (!item.tags.length) return <span className="text-muted-foreground">—</span>;
					return <FittingTags tags={item.tags} />;
				case "updatedAt":
				case "createdAt":
				case "publishedAt":
					return (
						<span className="tabular whitespace-nowrap text-muted-foreground text-xs">{formatDate(item[column])}</span>
					);
				case "slug":
					return <span className="font-mono text-muted-foreground text-xs">{item.slug || "—"}</span>;
				case "folder":
					return <span className="text-muted-foreground text-xs">{folderName(item.folderId)}</span>;
			}
		};

		return helper.columns([
			helper.display({
				id: "select",
				size: 44,
				enableResizing: false,
				header: ({ table }) => (
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						indeterminate={table.getIsSomePageRowsSelected()}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
						aria-label="현재 페이지 전체 선택"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(value === true)}
						aria-label={`${row.original.title ?? "제목 없음"} 선택`}
					/>
				),
			}),
			...available.map((column) =>
				helper.display({
					id: column,
					enableHiding: column !== "title",
					size: DEFAULT_COLUMN_SIZE[column] ?? DEFAULT_TITLE_SIZE,
					minSize: MIN_COLUMN_SIZE,
					maxSize: MAX_COLUMN_SIZE,
					header: () => (
						<ColumnHeader
							column={column}
							filter={filterFor(collection, column, mode)}
							state={state}
							options={options}
							onChange={onStateChange}
						/>
					),
					cell: ({ row }) => cell(row.original, column),
				}),
			),
			helper.display({
				id: "actions",
				size: 52,
				enableResizing: false,
				header: () => <span className="sr-only">작업</span>,
				cell: ({ row }) => (
					<div className="flex items-center justify-end gap-1 whitespace-nowrap">
						{isTrash && (
							<>
								<Button type="button" variant="ghost" size="xs" onClick={() => onRestore?.(row.original)}>
									복원
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="xs"
									className="text-destructive"
									onClick={() => onPermanentDelete?.(row.original)}
								>
									영구 삭제
								</Button>
							</>
						)}
						<MoreActionsButton actions={rowMenu(row.original)} label={`${row.original.title ?? "제목 없음"} 작업`} />
					</div>
				),
			}),
		]);
	}, [
		mode,
		availableKey,
		collection,
		state,
		options,
		onStateChange,
		isTrash,
		isRecord,
		folders,
		rowMenu,
		onOpenRecord,
		onRestore,
		onPermanentDelete,
		showFolderBesideTitle,
	]);

	const rowSelection: RowSelectionState = Object.fromEntries([...selectedIds].map((id) => [id, true]));
	const columnOrder: ColumnOrderState = ["select", ...order, "actions"];

	// 끄는 동안은 로컬 상태로 바로 반영하고, 멈추면 목록 설정에 저장한다.
	const savedSizes = columnSettings?.sizes;
	const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(savedSizes ?? {});
	useEffect(() => setColumnSizing(savedSizes ?? {}), [savedSizes]);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const persistSizes = (next: ColumnSizingState) => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			const sizes = Object.fromEntries(
				Object.entries(next)
					.filter(([id]) => available.includes(id as AdminListColumn))
					.map(([id, size]) => [id, Math.round(Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, size)))]),
			);
			onColumnSettingsChange({ order, visibility, sizes });
		}, 400);
	};
	const updateSizing = (updater: Updater<ColumnSizingState>) =>
		setColumnSizing((current) => {
			const next = resolve(updater, current);
			persistSizes(next);
			return next;
		});

	// 스크롤 영역의 실제 폭. 표 너비와 좁을 때 숨길 컬럼을 이 값으로 정한다.
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		setContainerWidth(element.clientWidth);
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(([entry]) => setContainerWidth(Math.floor(entry?.contentRect.width ?? 0)));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// 좁을 때 숨길 컬럼은 기본 너비와 제목 최소 너비로만 정한다. 사용자가 넓힌 너비는 숨김을 부르지 않고 가로 스크롤이 된다
	// (끄는 도중 다른 컬럼이 사라져 손잡이가 튀지 않도록).
	const defaultSizeOf = (id: string) =>
		id === "select" ? 44 : id === "actions" ? 52 : (DEFAULT_COLUMN_SIZE[id] ?? DEFAULT_TITLE_SIZE);
	const visibleIds = columnOrder.filter((id) => visibility[id] !== false);
	const autoHidden = new Set<string>();
	const naturalWidth = () =>
		visibleIds
			.filter((id) => !autoHidden.has(id))
			.reduce((sum, id) => sum + (id === "title" ? TITLE_MIN_WIDTH : defaultSizeOf(id)), 0);
	if (containerWidth > 0) {
		for (const id of HIDE_ORDER_WHEN_NARROW) {
			if (naturalWidth() <= containerWidth) break;
			if (visibleIds.includes(id)) autoHidden.add(id);
		}
	}
	const isShown = (id: string) => !autoHidden.has(id);
	// 제목은 너비를 정하지 않았으면 남는 폭을 채운다. 어느 컬럼이든 끌기 시작하면 그 순간의 제목 너비를 고정해서,
	// 끄는 컬럼만 커지고 손잡이가 커서를 그대로 따라가게 한다. 그 뒤 남는 폭은 작업 칸 앞의 빈 칸이 받는다.
	const flexTitleWidth =
		containerWidth > 0
			? Math.min(
					MAX_COLUMN_SIZE,
					Math.max(
						TITLE_MIN_WIDTH,
						containerWidth -
							visibleIds
								.filter((id) => id !== "title" && isShown(id))
								.reduce((sum, id) => sum + (columnSizing[id] ?? defaultSizeOf(id)), 0),
					),
				)
			: DEFAULT_TITLE_SIZE;
	const tableSizing: ColumnSizingState =
		columnSizing.title === undefined ? { ...columnSizing, title: flexTitleWidth } : columnSizing;
	const freezeTitle = () => {
		if (columnSizing.title === undefined) setColumnSizing((current) => ({ ...current, title: flexTitleWidth }));
	};

	const table = useTable({
		features,
		data: items,
		columns,
		getRowId: (row) => row.id,
		columnResizeMode: "onChange",
		state: { columnVisibility: visibility, columnOrder, rowSelection, columnSizing: tableSizing },
		onColumnSizingChange: updateSizing,
		onColumnVisibilityChange: (updater) =>
			onColumnSettingsChange({
				order,
				visibility: resolve(updater, visibility) as Record<string, boolean>,
				sizes: savedSizes,
			}),
		onColumnOrderChange: (updater) => {
			const next = resolve(updater, columnOrder).filter((id): id is AdminListColumn =>
				available.includes(id as AdminListColumn),
			);
			onColumnSettingsChange({ order: next, visibility, sizes: savedSizes });
		},
		// 선택 해제는 값이 false인 키로 올 수 있어 true인 ID만 남긴다.
		onRowSelectionChange: (updater) => {
			const next = resolve(updater, rowSelection);
			onSelectionChange(new Set(Object.entries(next).flatMap(([id, on]) => (on ? [id] : []))));
		},
	});

	const moveColumn = (column: AdminListColumn, direction: -1 | 1) => {
		const index = order.indexOf(column);
		const target = index + direction;
		if (target < 0 || target >= order.length) return;
		const next = [...order];
		[next[index], next[target]] = [next[target] as AdminListColumn, next[index] as AdminListColumn];
		onColumnSettingsChange({ order: next, visibility, sizes: savedSizes });
	};

	const leafColumns = table.getVisibleLeafColumns();
	const tableWidth =
		containerWidth > 0
			? Math.max(
					containerWidth,
					leafColumns.filter((column) => isShown(column.id)).reduce((sum, column) => sum + column.getSize(), 0),
				)
			: undefined;
	// 빈 칸까지 센 칸 수.
	const visibleCount = leafColumns.length - autoHidden.size + 1;
	const rowKeyDown = (item: ListEntriesItem) => (event: KeyboardEvent) => {
		if (event.key !== "Delete" || !onDeleteKey) return;
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, [contenteditable=true]")) return;
		event.preventDefault();
		onDeleteKey(item);
	};

	// 사이드바 트리와 같은 폴더 메뉴에 `열기`를 더한다.
	const folderRowMenu = (folder: Folder): MenuAction[] =>
		folderActions
			? [
					{ kind: "item", label: "열기", onSelect: () => onSelectFolder(folder.id) },
					{ kind: "separator" },
					...folderMenuActions(folder, folders, folderActions),
				]
			: [];

	const pageHref = (page: number) => `?page=${page}`;

	return (
		<section aria-label="항목 목록" className="flex min-h-0 flex-1 flex-col overflow-hidden">
			{errorMessage && (
				<Alert variant="danger" className="mx-5 mt-3 flex w-auto items-center justify-between">
					<AlertDescription className="col-start-auto">{errorMessage}</AlertDescription>
					<Button type="button" variant="outline" size="xs" onClick={onRetry}>
						다시 시도
					</Button>
				</Alert>
			)}

			<div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-auto">
				<Table
					containerClassName="overflow-visible"
					style={tableWidth ? { width: tableWidth } : undefined}
					className="table-fixed [&_td:first-child]:pl-5 [&_td:last-child]:pr-4 [&_th:first-child]:pl-5 [&_th:last-child]:pr-4"
				>
					<TableHeader className="sticky top-0 z-10 bg-background [&_tr]:border-b">
						{table.getHeaderGroups().map((group) => (
							<TableRow key={group.id}>
								{group.headers
									.filter((header) => isShown(header.column.id))
									.map((header) => {
										const sortField = COLUMN_CONFIG[header.column.id as AdminListColumn]?.sortField;
										const active = sortField !== undefined && sortField === state.sortField;
										return (
											<Fragment key={header.id}>
												{header.column.id === "actions" && <TableHead aria-hidden className="p-0" />}
												<TableHead
													style={{ width: header.getSize() }}
													className={cn(
														"group/th relative h-9 font-normal text-muted-foreground text-xs",
														header.column.id === "select" && "w-10",
													)}
													aria-sort={active ? (state.sortDirection === "asc" ? "ascending" : "descending") : undefined}
												>
													{header.isPlaceholder ? null : <table.FlexRender header={header} />}
													{header.column.getCanResize() && (
														<ColumnResizeHandle
															label={COLUMN_LABELS[header.column.id as AdminListColumn] ?? header.column.id}
															width={header.getSize()}
															resizing={header.column.getIsResizing()}
															onStart={(event) => {
																freezeTitle();
																header.getResizeHandler()(event);
															}}
															onNudge={(delta) =>
																updateSizing((current) => ({
																	...tableSizing,
																	...current,
																	[header.column.id]: Math.min(
																		MAX_COLUMN_SIZE,
																		Math.max(MIN_COLUMN_SIZE, header.getSize() + delta),
																	),
																}))
															}
															onReset={() =>
																updateSizing((current) => {
																	const { [header.column.id]: _removed, ...rest } = current;
																	return rest;
																})
															}
														/>
													)}
												</TableHead>
											</Fragment>
										);
									})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{explorer && explorer.parent !== null && (
							<TableRow>
								<TableCell className="text-center text-muted-foreground">
									<FolderUp aria-hidden className="mx-auto size-4" />
								</TableCell>
								<TableCell colSpan={visibleCount - 1}>
									<Button
										type="button"
										variant="link"
										size="sm"
										onClick={() => onSelectFolder(explorer.parent ?? "all")}
										className="h-auto p-0 text-muted-foreground hover:text-foreground"
									>
										.. 상위 폴더로
									</Button>
								</TableCell>
							</TableRow>
						)}
						{explorer?.folders.map((folder) => (
							<ActionContextMenu key={`folder-${folder.id}`} actions={folderRowMenu(folder)} trigger={<TableRow />}>
								<TableCell className="text-center text-muted-foreground">
									<FolderIcon aria-hidden className="mx-auto size-4" />
								</TableCell>
								<TableCell colSpan={visibleCount - 2} className="font-medium">
									<Button
										type="button"
										variant="link"
										size="sm"
										onClick={() => onSelectFolder(folder.id)}
										onKeyDown={folderActions ? folderKeyHandler(folder, folderActions) : undefined}
										className="h-auto p-0 font-medium text-foreground"
									>
										{folder.name}
									</Button>
								</TableCell>
								<TableCell className="text-right">
									<MoreActionsButton actions={folderRowMenu(folder)} label={`'${folder.name}' 폴더 작업`} />
								</TableCell>
							</ActionContextMenu>
						))}
						{isLoading ? (
							Array.from({ length: 5 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시 행
								<TableRow key={index} aria-hidden>
									<TableCell colSpan={visibleCount}>
										<Skeleton className="h-5 w-full" />
									</TableCell>
								</TableRow>
							))
						) : items.length === 0 && !explorer?.folders.length ? (
							<TableRow>
								<TableCell colSpan={visibleCount} className="p-0">
									<Empty className="py-10">
										<EmptyHeader>
											<EmptyTitle>{isTrash ? "휴지통이 비었습니다." : "조건에 맞는 항목이 없습니다."}</EmptyTitle>
											{!isTrash && <EmptyDescription>필터를 지우거나 새로 만들어 보세요.</EmptyDescription>}
										</EmptyHeader>
									</Empty>
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<ActionContextMenu
									key={row.id}
									actions={rowMenu(row.original)}
									trigger={
										<TableRow
											className="h-11 data-[state=selected]:bg-primary/5"
											data-state={row.getIsSelected() ? "selected" : undefined}
											draggable={!isTrash}
											onDragStart={(event) => {
												// 선택한 행을 끌면 선택 전체를, 아니면 이 행만 옮긴다.
												const group = selectedIds.has(row.original.id)
													? items.filter((item) => selectedIds.has(item.id))
													: [row.original];
												writeDraggedEntries(
													event,
													group.map((item) => ({ id: item.id, expectedVersion: item.version })),
												);
											}}
											onKeyDown={rowKeyDown(row.original)}
										/>
									}
								>
									{row
										.getVisibleCells()
										.filter((cell) => isShown(cell.column.id))
										.map((cell) => (
											<Fragment key={cell.id}>
												{cell.column.id === "actions" && <TableCell aria-hidden className="p-0" />}
												<TableCell className="overflow-hidden text-ellipsis whitespace-nowrap">
													<table.FlexRender cell={cell} />
												</TableCell>
											</Fragment>
										))}
								</ActionContextMenu>
							))
						)}
					</TableBody>
				</Table>
				{blankMenu && (
					<ActionContextMenu actions={blankMenu} trigger={<div className="min-h-12 flex-1" aria-hidden />} />
				)}
			</div>

			<div className="flex h-12 shrink-0 items-center justify-between gap-3 border-t px-5 text-muted-foreground text-xs">
				<span className="tabular">
					{total}개 중{" "}
					{items.length > 0
						? `${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, total)}`
						: "0"}
				</span>
				<div className="flex items-center gap-2">
					<Popover>
						<PopoverTrigger
							render={<Button type="button" variant="ghost" size="xs" className="text-muted-foreground" />}
						>
							<Columns3 aria-hidden />
							컬럼 설정
						</PopoverTrigger>
						<PopoverContent align="end" className="w-64 p-3">
							<p className="mb-2 text-muted-foreground text-xs">
								제목은 항상 보입니다. 표시와 순서는 컬렉션별로 저장됩니다.
							</p>
							<ul className="space-y-1">
								{order.map((column, index) => (
									<li
										key={column}
										className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-accent"
									>
										<Label className="font-normal">
											<Checkbox
												checked={visibility[column] ?? false}
												disabled={column === "title"}
												onCheckedChange={(checked) => table.getColumn(column)?.toggleVisibility(checked === true)}
											/>
											{COLUMN_LABELS[column]}
										</Label>
										<span className="flex gap-1">
											<Button
												type="button"
												size="icon-xs"
												variant="outline"
												aria-label={`${COLUMN_LABELS[column]} 컬럼 위로`}
												disabled={index === 0}
												onClick={() => moveColumn(column, -1)}
											>
												<ArrowUp aria-hidden />
											</Button>
											<Button
												type="button"
												size="icon-xs"
												variant="outline"
												aria-label={`${COLUMN_LABELS[column]} 컬럼 아래로`}
												disabled={index === order.length - 1}
												onClick={() => moveColumn(column, 1)}
											>
												<ArrowDown aria-hidden />
											</Button>
										</span>
									</li>
								))}
							</ul>
						</PopoverContent>
					</Popover>
					<Select
						value={String(state.pageSize)}
						items={PAGE_SIZES.map((size) => ({ value: String(size), label: `${size}개씩 보기` }))}
						onValueChange={(value) => value && onPageSizeChange(Number(value) as PageSize)}
					>
						<SelectTrigger size="sm" aria-label="페이지 크기" className="h-7 border-0 text-xs shadow-none">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}개씩 보기
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Pagination className="mx-0 w-auto">
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									href={pageHref(state.page - 1)}
									aria-disabled={state.page <= 1}
									className={cn(state.page <= 1 && "pointer-events-none opacity-50")}
									onClick={(event) => {
										event.preventDefault();
										if (state.page > 1) onPageChange(state.page - 1);
									}}
								/>
							</PaginationItem>
							<PaginationItem>
								<span className="px-2 tabular-nums">
									{state.page} / {totalPages}
								</span>
							</PaginationItem>
							<PaginationItem>
								<PaginationNext
									href={pageHref(state.page + 1)}
									aria-disabled={state.page >= totalPages}
									className={cn(state.page >= totalPages && "pointer-events-none opacity-50")}
									onClick={(event) => {
										event.preventDefault();
										if (state.page < totalPages) onPageChange(state.page + 1);
									}}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			</div>
		</section>
	);
}
