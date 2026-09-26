"use client";

import { ChevronDown, ChevronRight, Edit2, Folder as FolderIcon, FolderOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { COLLECTION_DEFINITIONS, COLLECTIONS, type Collection } from "@/cms/core/collections";
import { type DraggedEntry, isEntryDrag, readDraggedEntries } from "./shared/entry-drag";
import type { FolderActions } from "./shared/use-folder-actions";

export type AdminNavId = Collection | "media" | "templates";

interface SidebarProps {
	currentCollection?: Collection;
	/** `all`·`unfiled`·폴더 ID. */
	currentFolder?: string;
	includeDescendants?: boolean;
	folders?: Folder[];
	activeNav?: AdminNavId;
	folderActions?: FolderActions;
	onSelectCollection?: (collection: Collection) => void;
	onSelectFolder?: (folder: string) => void;
	onIncludeDescendantsChange?: (value: boolean) => void;
	/** 목록 행을 폴더(또는 미분류)로 끌어 놓았을 때. */
	onDropEntries?: (folderId: string | null, entries: DraggedEntry[]) => void;
	onNavigate?: () => void;
}

const itemClass = (active: boolean) =>
	`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium text-sm transition ${
		active
			? "bg-neutral-800 font-semibold text-white"
			: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
	}`;

/** 왼쪽 탐색 영역(§3.1): 컬렉션, 가상 폴더 트리(§3.3), 미디어·템플릿. */
export function AdminSidebar({
	currentCollection,
	currentFolder = "all",
	includeDescendants = false,
	folders = [],
	activeNav,
	folderActions,
	onSelectCollection,
	onSelectFolder,
	onIncludeDescendantsChange,
	onDropEntries,
	onNavigate,
}: SidebarProps) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const active: AdminNavId = activeNav ?? currentCollection ?? "post";

	// 선택한 폴더의 조상 경로를 펼친다.
	useEffect(() => {
		if (currentFolder === "all" || currentFolder === "unfiled") return;
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

	const toggle = (id: string) =>
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const select = (folder: string) => {
		onSelectFolder?.(folder);
		onNavigate?.();
	};

	const dropProps = (key: string, folderId: string | null) =>
		onDropEntries
			? {
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
						if (entries.length > 0) onDropEntries(folderId, entries);
					},
				}
			: {};

	const renderFolder = (folder: Folder, depth: number) => {
		const children = folders.filter((f) => f.parentId === folder.id);
		const isExpanded = expandedIds.has(folder.id);
		const isActive = currentFolder === folder.id;
		return (
			<li key={folder.id}>
				<div
					{...dropProps(folder.id, folder.id)}
					className={`group flex items-center gap-1 rounded-md px-1 py-1 text-xs ${
						isActive ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"
					} ${dropTarget === folder.id ? "ring-2 ring-blue-500" : ""}`}
					style={{ paddingLeft: `${depth * 12 + 4}px` }}
				>
					{children.length > 0 ? (
						<button
							type="button"
							aria-label={`${folder.name} 하위 폴더 ${isExpanded ? "접기" : "펼치기"}`}
							aria-expanded={isExpanded}
							onClick={() => toggle(folder.id)}
							className="rounded p-0.5 hover:bg-neutral-700/60"
						>
							{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
						</button>
					) : (
						<span className="w-4" />
					)}
					<button
						type="button"
						aria-current={isActive ? "true" : undefined}
						onClick={() => select(folder.id)}
						className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
					>
						{isExpanded ? (
							<FolderOpen className="h-3.5 w-3.5 shrink-0" />
						) : (
							<FolderIcon className="h-3.5 w-3.5 shrink-0" />
						)}
						<span className="truncate">{folder.name}</span>
					</button>
					{folderActions && (
						<span className="flex shrink-0 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
							<button
								type="button"
								aria-label={`${folder.name}에 하위 폴더 추가`}
								onClick={() => folderActions.requestCreate(folder.id)}
								className="rounded p-1 hover:bg-neutral-700/60"
							>
								<Plus className="h-3 w-3" />
							</button>
							<button
								type="button"
								aria-label={`폴더 이름 변경: ${folder.name}`}
								onClick={() => folderActions.requestRename(folder)}
								className="rounded p-1 hover:bg-neutral-700/60"
							>
								<Edit2 className="h-3 w-3" />
							</button>
							<button
								type="button"
								aria-label={`폴더 삭제: ${folder.name}`}
								onClick={() => void folderActions.requestDelete(folder)}
								className="rounded p-1 hover:bg-neutral-700/60 hover:text-red-400"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</span>
					)}
				</div>
				{isExpanded && children.length > 0 && <ul>{children.map((child) => renderFolder(child, depth + 1))}</ul>}
			</li>
		);
	};

	const label = COLLECTION_DEFINITIONS[currentCollection ?? "post"].label;
	const hasFolderNav = Boolean(onSelectFolder && currentCollection);

	return (
		<aside className="flex h-full min-h-0 w-60 shrink-0 flex-col gap-6 overflow-y-auto border-neutral-800 border-r bg-neutral-900/60 p-4">
			<nav aria-label="관리자 섹션">
				<p className="mb-2 px-2 font-semibold text-neutral-400 text-xs uppercase tracking-wider">컬렉션</p>
				<ul className="flex flex-col gap-1">
					{COLLECTIONS.map((collection) => (
						<li key={collection}>
							{onSelectCollection ? (
								<button
									type="button"
									aria-current={active === collection ? "page" : undefined}
									onClick={() => {
										onSelectCollection(collection);
										onNavigate?.();
									}}
									className={itemClass(active === collection)}
								>
									{COLLECTION_DEFINITIONS[collection].label}
								</button>
							) : (
								<Link
									href={`/admin?collection=${collection}`}
									onClick={onNavigate}
									aria-current={active === collection ? "page" : undefined}
									className={itemClass(active === collection)}
								>
									{COLLECTION_DEFINITIONS[collection].label}
								</Link>
							)}
						</li>
					))}
					<li className="mt-1 border-neutral-800/80 border-t pt-1">
						<Link
							href="/admin/media"
							onClick={onNavigate}
							aria-current={active === "media" ? "page" : undefined}
							className={itemClass(active === "media")}
						>
							미디어
						</Link>
					</li>
					<li>
						<Link
							href="/admin/templates"
							onClick={onNavigate}
							aria-current={active === "templates" ? "page" : undefined}
							className={itemClass(active === "templates")}
						>
							본문 템플릿
						</Link>
					</li>
				</ul>
			</nav>

			{hasFolderNav && (
				<section aria-label={`${label} 폴더`} className="flex-1">
					<div className="mb-2 flex items-center justify-between px-2 font-semibold text-neutral-400 text-xs uppercase tracking-wider">
						<span>폴더</span>
						{folderActions && (
							<button
								type="button"
								onClick={() => folderActions.requestCreate(null)}
								className="font-normal hover:text-white"
							>
								+ 폴더
							</button>
						)}
					</div>
					<ul className="flex flex-col gap-0.5 text-xs">
						<li>
							<button
								type="button"
								aria-current={currentFolder === "all" ? "true" : undefined}
								onClick={() => select("all")}
								className={`w-full rounded-md px-2 py-1 text-left ${currentFolder === "all" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"}`}
							>
								전체 {label}
							</button>
						</li>
						<li>
							<button
								type="button"
								{...dropProps("unfiled", null)}
								aria-current={currentFolder === "unfiled" ? "true" : undefined}
								onClick={() => select("unfiled")}
								className={`w-full rounded-md px-2 py-1 text-left ${currentFolder === "unfiled" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/40"} ${dropTarget === "unfiled" ? "ring-2 ring-blue-500" : ""}`}
							>
								미분류
							</button>
						</li>
						{folders.filter((f) => !f.parentId).map((folder) => renderFolder(folder, 0))}
					</ul>
					{folders.length === 0 && <p className="px-2 py-2 text-neutral-500 text-xs">만든 폴더가 없습니다.</p>}
					{onIncludeDescendantsChange && currentFolder !== "all" && currentFolder !== "unfiled" && (
						<label className="mt-3 flex items-center gap-2 px-2 text-neutral-400 text-xs">
							<input
								type="checkbox"
								checked={includeDescendants}
								onChange={(event) => onIncludeDescendantsChange(event.target.checked)}
							/>
							하위 폴더 포함
						</label>
					)}
					{onDropEntries && (
						<p className="mt-3 px-2 text-[10px] text-neutral-500">목록의 글을 폴더로 끌어 옮길 수 있습니다.</p>
					)}
				</section>
			)}
		</aside>
	);
}
