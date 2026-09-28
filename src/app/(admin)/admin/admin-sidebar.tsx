"use client";

import {
	ChevronRight,
	FileImage,
	FileText,
	Folder as FolderIcon,
	FolderOpen,
	Globe,
	Layers,
	LayoutTemplate,
	NotebookPen,
	Plus,
	Shapes,
	Tag,
	Trash2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { COLLECTION_DEFINITIONS, COLLECTIONS, type Collection } from "@/cms/core/collections";
import { ThemeToggle } from "@/components/theme-toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./shared/action-menu";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import { type FolderActions, folderMenuActions } from "./shared/use-folder-actions";

export type AdminNavId = Collection | "media" | "templates" | "trash";

const COLLECTION_ICONS: Record<Collection, React.ReactNode> = {
	post: <FileText />,
	memo: <NotebookPen />,
	category: <Shapes />,
	tag: <Tag />,
	collection: <Layers />,
};

/** 목록 화면에서만 쓰는 폴더 탐색(§3.3). */
export interface FolderNavigation {
	collection: Collection;
	/** `all`(최상위)·폴더 ID. */
	currentFolder: string;
	includeDescendants: boolean;
	folders: Folder[];
	folderActions: FolderActions;
	onSelectFolder: (folder: string) => void;
	onIncludeDescendantsChange: (value: boolean) => void;
	/** 목록 행을 폴더(또는 최상위)로 끌어 놓았을 때. */
	onDropEntries: (folderId: string | null, entries: DraggedEntry[]) => void;
	onCreateEntry: () => void;
}

export interface AdminSidebarProps {
	activeNav: AdminNavId;
	folderNav?: FolderNavigation;
	trashCount?: number | null;
}

/** 파일 탐색기처럼 F2는 이름 변경, Delete는 삭제(확인 대화상자)를 연다. */
export function folderKeyHandler(folder: Folder, actions: FolderActions) {
	return (event: KeyboardEvent) => {
		if (event.key === "F2") {
			event.preventDefault();
			actions.requestRename(folder);
		} else if (event.key === "Delete") {
			event.preventDefault();
			void actions.requestDelete(folder);
		}
	};
}

/**
 * 트리 연결선. 각 줄 왼쪽에 세로선과 `ㄴ`자 가로선을 그리고, 마지막 줄의 세로선은 가로선에서 끊는다.
 * 줄 높이(28px)의 절반인 14px에 가로선을 둔다. 세로선은 부모 폴더 아이콘(또는 최상위 아이콘) 가운데에 온다.
 */
const TREE_LIST = "mx-0 translate-x-0 gap-0 border-l-0 py-0 pr-0 pl-6";
const TREE_ITEM =
	"before:-left-3 after:-left-3 before:absolute before:top-0 before:h-full before:w-px before:bg-sidebar-foreground/20 after:absolute after:top-3.5 after:h-px after:w-3.5 after:bg-sidebar-foreground/20 last:before:h-3.5";

function FolderTree({ nav, closeMobile }: { nav: FolderNavigation; closeMobile: () => void }) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const { folders, currentFolder } = nav;

	// 선택한 폴더의 조상 경로를 펼친다.
	useEffect(() => {
		if (currentFolder === "all") return;
		setExpandedIds((prev) => {
			const next = new Set(prev);
			let folder = folders.find((f) => f.id === currentFolder);
			while (folder?.parentId) {
				next.add(folder.parentId);
				folder = folders.find((f) => f.id === folder?.parentId);
			}
			return next;
		});
	}, [currentFolder, folders]);

	const select = (folder: string) => {
		nav.onSelectFolder(folder);
		closeMobile();
	};

	const dropProps = (key: string, folderId: string | null) => ({
		onDragOver: (event: React.DragEvent) => {
			if (!isEntryDrag(event)) return;
			event.preventDefault();
			setDropTarget(key);
		},
		onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
		onDrop: (event: React.DragEvent) => {
			event.preventDefault();
			setDropTarget(null);
			const entries = readDraggedEntries(event);
			if (entries.length > 0) nav.onDropEntries(folderId, entries);
		},
	});

	const renderFolder = (folder: Folder) => {
		const children = folders.filter((f) => f.parentId === folder.id);
		const isExpanded = expandedIds.has(folder.id);
		const isActive = currentFolder === folder.id;
		const actions = folderMenuActions(folder, nav.folders, nav.folderActions);
		return (
			<Collapsible
				key={folder.id}
				open={isExpanded}
				onOpenChange={(open) =>
					setExpandedIds((prev) => {
						const next = new Set(prev);
						if (open) next.add(folder.id);
						else next.delete(folder.id);
						return next;
					})
				}
				render={<SidebarMenuSubItem className={TREE_ITEM} />}
			>
				<ActionContextMenu
					actions={actions}
					trigger={
						<div
							{...dropProps(folder.id, folder.id)}
							data-active={isActive || undefined}
							className={cn(
								"group/folder flex h-7 items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground",
								dropTarget === folder.id && "ring-2 ring-sidebar-ring",
							)}
						/>
					}
				>
					{/* 폴더 아이콘이 펼침 단추를 겸한다. 하위 폴더가 있으면 올려 두거나 초점을 주면 화살표로 바뀐다. */}
					{children.length > 0 ? (
						<CollapsibleTrigger
							aria-label={`${folder.name} 하위 폴더 ${isExpanded ? "접기" : "펼치기"}`}
							className="group/toggle flex size-6 shrink-0 items-center justify-center rounded-md outline-hidden hover:bg-sidebar-foreground/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4"
						>
							<span className="group-hover/toggle:hidden group-focus-visible/toggle:hidden">
								{isExpanded ? <FolderOpen aria-hidden /> : <FolderIcon aria-hidden />}
							</span>
							<ChevronRight
								aria-hidden
								className={cn(
									"hidden transition-transform group-hover/toggle:block group-focus-visible/toggle:block",
									isExpanded && "rotate-90",
								)}
							/>
						</CollapsibleTrigger>
					) : (
						<span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
							<FolderIcon className="size-4" />
						</span>
					)}
					<SidebarMenuButton
						size="sm"
						isActive={isActive}
						aria-current={isActive ? "true" : undefined}
						onClick={() => select(folder.id)}
						onKeyDown={folderKeyHandler(folder, nav.folderActions)}
						className="min-w-0 flex-1 bg-transparent pl-1 hover:bg-transparent active:bg-transparent data-active:bg-transparent"
					>
						<span>{folder.name}</span>
					</SidebarMenuButton>
					<MoreActionsButton
						actions={actions}
						label={`'${folder.name}' 폴더 작업`}
						className="size-6 shrink-0 text-sidebar-foreground/70"
					/>
				</ActionContextMenu>
				{children.length > 0 && (
					<CollapsibleContent>
						<SidebarMenuSub className={cn(TREE_LIST, "ml-0")}>{children.map(renderFolder)}</SidebarMenuSub>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	};

	const label = COLLECTION_DEFINITIONS[nav.collection].label;
	const blankActions: MenuAction[] = [
		{ kind: "item", label: "새 폴더", onSelect: () => nav.folderActions.requestCreate(null) },
		{ kind: "item", label: `새 ${label}`, onSelect: nav.onCreateEntry },
	];

	return (
		<SidebarGroup className="flex-1 group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>폴더</SidebarGroupLabel>
			<SidebarGroupAction aria-label="새 폴더" title="새 폴더" onClick={() => nav.folderActions.requestCreate(null)}>
				<Plus />
			</SidebarGroupAction>
			<SidebarGroupContent className="flex flex-1 flex-col">
				<SidebarMenu>
					<SidebarMenuItem>
						<ActionContextMenu actions={blankActions} trigger={<div />}>
							<SidebarMenuButton
								size="sm"
								{...dropProps("root", null)}
								isActive={currentFolder === "all"}
								aria-current={currentFolder === "all" ? "true" : undefined}
								onClick={() => select("all")}
								className={cn(dropTarget === "root" && "ring-2 ring-sidebar-ring")}
							>
								{COLLECTION_ICONS[nav.collection]}
								<span>{label}</span>
							</SidebarMenuButton>
						</ActionContextMenu>
						{folders.length > 0 && (
							<SidebarMenuSub aria-label={`${label} 폴더`} className={cn(TREE_LIST, "ml-1")}>
								{folders.filter((f) => !f.parentId).map(renderFolder)}
							</SidebarMenuSub>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
				{folders.length === 0 && <p className="px-2 py-2 text-muted-foreground text-xs">만든 폴더가 없습니다.</p>}
				{folders.length > 0 && (
					<Label className="mt-3 px-2 font-normal text-muted-foreground text-xs">
						<Checkbox
							checked={nav.includeDescendants}
							onCheckedChange={(checked) => nav.onIncludeDescendantsChange(checked === true)}
						/>
						하위 폴더 포함
					</Label>
				)}
				{/* 빈 곳의 오른쪽 클릭 메뉴(v2 A2). 폴더 줄의 메뉴와 겹치지 않도록 목록 아래 빈 영역에만 붙인다. */}
				<ActionContextMenu actions={blankActions} trigger={<div aria-hidden className="min-h-16 flex-1" />} />
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

/** 왼쪽 탐색 영역(§3.1): 컬렉션, 미디어·템플릿·휴지통, 가상 폴더 트리(§3.3). */
export function AdminSidebar({ activeNav, folderNav, trashCount }: AdminSidebarProps) {
	const { isMobile, setOpenMobile, state } = useSidebar();
	const toggleLabel = isMobile ? "사이드바 닫기" : state === "collapsed" ? "사이드바 펼치기" : "사이드바 접기";
	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	const navLink = (href: string, id: AdminNavId, label: string, icon?: React.ReactNode, badge?: React.ReactNode) => (
		<SidebarMenuItem key={id}>
			<SidebarMenuButton
				isActive={activeNav === id}
				tooltip={label}
				render={
					<Link href={href as Route} onClick={closeMobile} aria-current={activeNav === id ? "page" : undefined} />
				}
			>
				{icon}
				<span>{label}</span>
			</SidebarMenuButton>
			{badge}
		</SidebarMenuItem>
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="flex-row items-center gap-1 px-3 pt-3.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
				<Link
					href="/admin"
					onClick={closeMobile}
					className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 group-data-[collapsible=icon]:hidden"
				>
					<span
						aria-hidden
						className="flex size-6 items-center justify-center rounded-md bg-sidebar-primary font-semibold text-sidebar-primary-foreground text-xs"
					>
						b
					</span>
					<span className="font-semibold text-[13px] text-sidebar-accent-foreground">bh2980.dev</span>
				</Link>
				<Tooltip>
					<TooltipTrigger
						render={<SidebarTrigger aria-label={toggleLabel} className="size-8 shrink-0 text-sidebar-foreground/70" />}
					/>
					<TooltipContent side="right">{toggleLabel}</TooltipContent>
				</Tooltip>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>컬렉션</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label="컬렉션">
							{COLLECTIONS.map((collection) =>
								navLink(
									`/admin?collection=${collection}`,
									collection,
									COLLECTION_DEFINITIONS[collection].label,
									COLLECTION_ICONS[collection],
								),
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>관리</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu aria-label="관리">
							{navLink("/admin/media", "media", "미디어", <FileImage />)}
							{navLink("/admin/templates", "templates", "본문 템플릿", <LayoutTemplate />)}
							{navLink(
								"/admin/trash",
								"trash",
								"휴지통",
								<Trash2 />,
								trashCount ? (
									<SidebarMenuBadge aria-label={`휴지통 ${trashCount}개`}>{trashCount}</SidebarMenuBadge>
								) : null,
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{folderNav && <FolderTree nav={folderNav} closeMobile={closeMobile} />}
			</SidebarContent>
			<SidebarFooter className="flex-row items-center gap-1 border-sidebar-border border-t px-3 py-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-2">
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href="/"
								aria-label="블로그 보기"
								className="flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
							/>
						}
					>
						<Globe aria-hidden className="size-4" />
						<span className="group-data-[collapsible=icon]:hidden">블로그 보기</span>
					</TooltipTrigger>
					<TooltipContent side="right" hidden={state !== "collapsed" || isMobile}>
						블로그 보기
					</TooltipContent>
				</Tooltip>
				<ThemeToggle className="size-8 text-muted-foreground" />
			</SidebarFooter>
		</Sidebar>
	);
}
