"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
	ChevronRight,
	ChevronDown,
	Folder as FolderIcon,
	FolderOpen,
	Plus,
	Edit2,
	Trash2,
} from "lucide-react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import type { Collection } from "@/cms/services/types";

export type AdminNavId = Collection | "media" | "templates";

interface SidebarProps {
	currentCollection?: Collection;
	currentFolderId?: string | null;
	folders?: Folder[];
	activeNav?: AdminNavId;
	onSelectCollection?: (col: Collection) => void;
	onSelectFolder?: (folderId: string | null) => void;
	onCreateFolder?: (name: string, parentId: string | null) => Promise<void>;
	onRenameFolder?: (id: string, name: string, version: number) => Promise<void>;
	onDeleteFolder?: (id: string, version: number) => Promise<void>;
}

export function AdminSidebar({
	currentCollection,
	currentFolderId,
	folders = [],
	activeNav,
	onSelectCollection,
	onSelectFolder,
	onCreateFolder,
	onRenameFolder,
	onDeleteFolder,
}: SidebarProps) {
	const [newFolderName, setNewFolderName] = useState("");
	const [isCreatingRoot, setIsCreatingRoot] = useState(false);
	const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
	const [subFolderName, setSubFolderName] = useState("");
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [isFolderSectionOpen, setIsFolderSectionOpen] = useState(true);
	const prevFolderIdRef = useRef<string | null | undefined>(undefined);

	const active: AdminNavId = activeNav ?? currentCollection ?? "post";

	const collections: { id: Collection; label: string }[] = [
		{ id: "post", label: "게시글 (Posts)" },
		{ id: "memo", label: "메모 (Memos)" },
		{ id: "category", label: "카테고리 (Categories)" },
		{ id: "tag", label: "태그 (Tags)" },
		{ id: "collection", label: "모음집 (Collections)" },
	];

	// 사용자가 다른 폴더로 이동(선택)했을 때만 해당 폴더의 부모 경로를 자동으로 펼침
	useEffect(() => {
		if (prevFolderIdRef.current === currentFolderId) return;
		prevFolderIdRef.current = currentFolderId;

		if (!currentFolderId || folders.length === 0) return;
		setExpandedIds((prev) => {
			const next = new Set(prev);
			let curr = folders.find((f) => f.id === currentFolderId);
			while (curr?.parentId) {
				next.add(curr.parentId);
				curr = folders.find((f) => f.id === curr!.parentId);
			}
			return next;
		});
	}, [currentFolderId, folders]);

	// 폴더 계층 구조 빌드
	const rootFolders = folders.filter((f) => !f.parentId);
	const getChildren = (parentId: string) => folders.filter((f) => f.parentId === parentId);

	const toggleExpand = (folderId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(folderId)) {
				next.delete(folderId);
			} else {
				next.add(folderId);
			}
			return next;
		});
	};

	const handleCreateRootFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFolderName.trim() || !onCreateFolder) return;
		try {
			await onCreateFolder(newFolderName.trim(), null);
			setNewFolderName("");
			setIsCreatingRoot(false);
		} catch (err: any) {
			alert("폴더 생성 실패: " + (err.message || String(err)));
		}
	};

	const handleCreateSubFolder = async (parentId: string, e: React.FormEvent) => {
		e.preventDefault();
		if (!subFolderName.trim() || !onCreateFolder) return;
		try {
			await onCreateFolder(subFolderName.trim(), parentId);
			setSubFolderName("");
			setCreatingParentId(null);
			setExpandedIds((prev) => new Set(prev).add(parentId));
		} catch (err: any) {
			alert("하위 폴더 생성 실패: " + (err.message || String(err)));
		}
	};

	const renderFolderItem = (folder: Folder) => {
		const isFolderActive = currentFolderId === folder.id;
		const children = getChildren(folder.id);
		const hasChildren = children.length > 0;
		const isExpanded = expandedIds.has(folder.id);
		const isCreatingHere = creatingParentId === folder.id;

		return (
			<div key={folder.id} className="flex flex-col">
				<div
					className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition select-none ${
						isFolderActive
							? "bg-neutral-800 text-white font-medium"
							: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
					}`}
				>
					<div
						className="flex flex-1 items-center gap-1 min-w-0 cursor-pointer"
						onClick={() => {
							onSelectFolder?.(folder.id);
							if (hasChildren) {
								setExpandedIds((prev) => {
									const next = new Set(prev);
									if (next.has(folder.id)) {
										next.delete(folder.id);
									} else {
										next.add(folder.id);
									}
									return next;
								});
							}
						}}
					>
						{/* 토글 화살표 */}
						{hasChildren ? (
							<button
								type="button"
								onClick={(e) => toggleExpand(folder.id, e)}
								className="p-0.5 hover:bg-neutral-700/60 rounded text-neutral-400 hover:text-white transition"
							>
								{isExpanded ? (
									<ChevronDown className="h-3 w-3" />
								) : (
									<ChevronRight className="h-3 w-3" />
								)}
							</button>
						) : (
							<span className="w-4" />
						)}

						{/* 폴더 아이콘 */}
						{isExpanded && hasChildren ? (
							<FolderOpen className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-200 flex-shrink-0" />
						) : (
							<FolderIcon className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-200 flex-shrink-0" />
						)}

						<span className="truncate text-xs font-normal">{folder.name}</span>
					</div>

					{/* 액션 버튼들 (호버 시 노출) */}
					{onRenameFolder && onDeleteFolder && (
						<div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition flex-shrink-0">
							{onCreateFolder && (
								<button
									type="button"
									title="하위 폴더 추가"
									onClick={(e) => {
										e.stopPropagation();
										setCreatingParentId(folder.id);
										setSubFolderName("");
										setExpandedIds((prev) => new Set(prev).add(folder.id));
									}}
									className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700/60"
								>
									<Plus className="h-3 w-3" />
								</button>
							)}
							<button
								type="button"
								title="이름 변경"
								onClick={async (e) => {
									e.stopPropagation();
									const next = prompt("새 폴더 이름:", folder.name);
									if (next && next.trim() && next !== folder.name) {
										await onRenameFolder(folder.id, next.trim(), folder.version);
									}
								}}
								className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700/60"
							>
								<Edit2 className="h-3 w-3" />
							</button>
							<button
								type="button"
								title="삭제"
								onClick={async (e) => {
									e.stopPropagation();
									if (confirm(`'${folder.name}' 폴더를 삭제하시겠습니까? (하위 글은 보존됩니다)`)) {
										await onDeleteFolder(folder.id, folder.version);
									}
								}}
								className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-700/60"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</div>
					)}
				</div>

				{/* 하위 폴더 계층 (트리 세로 라인 & 들여쓰기) */}
				{isExpanded && (
					<div className="ml-3 pl-2.5 border-l border-neutral-800 flex flex-col gap-1 mt-0.5">
						{/* 하위 폴더 생성 인라인 폼 */}
						{isCreatingHere && (
							<form
								onSubmit={(e) => handleCreateSubFolder(folder.id, e)}
								className="flex items-center gap-1 my-1 px-1"
							>
								<input
									type="text"
									placeholder="하위 폴더 이름"
									value={subFolderName}
									onChange={(e) => setSubFolderName(e.target.value)}
									className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
									autoFocus
								/>
								<button
									type="button"
									onClick={() => setCreatingParentId(null)}
									className="text-[11px] text-neutral-400 hover:text-white px-1"
								>
									취소
								</button>
							</form>
						)}

						{children.map((child) => renderFolderItem(child))}
					</div>
				)}
			</div>
		);
	};

	return (
		<aside className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900/60 p-4 flex flex-col gap-6">
			<div>
				<div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 px-2 flex items-center justify-between">
					<span>컬렉션</span>
					<Link
						href="/admin"
						className="text-[10px] font-normal text-neutral-500 hover:text-neutral-300 transition"
					>
						대시보드 홈
					</Link>
				</div>
				<nav className="flex flex-col gap-1">
					{collections.map((col) => {
						const isItemActive = active === col.id;
						if (onSelectCollection) {
							return (
								<button
									key={col.id}
									type="button"
									onClick={() => onSelectCollection(col.id)}
									className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
										isItemActive
											? "bg-neutral-800 text-white font-semibold"
											: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
									}`}
								>
									<span>{col.label}</span>
								</button>
							);
						}
						return (
							<Link
								key={col.id}
								href={`/admin?collection=${col.id}`}
								className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
									isItemActive
										? "bg-neutral-800 text-white font-semibold"
										: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
								}`}
							>
								<span>{col.label}</span>
							</Link>
						);
					})}
					<Link
						href="/admin/media"
						className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition mt-1 border-t border-neutral-800/80 pt-2 ${
							active === "media"
								? "bg-neutral-800 text-white font-semibold"
								: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
						}`}
					>
						<span>미디어 라이브러리 (Media)</span>
					</Link>
					<Link
						href="/admin/templates"
						className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
							active === "templates"
								? "bg-neutral-800 text-white font-semibold"
								: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
						}`}
					>
						<span>본문 템플릿 (Templates)</span>
					</Link>
				</nav>
			</div>

			{folders && onSelectFolder ? (
				<div className="flex-1 overflow-y-auto">
					<div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 px-2">
						<button
							type="button"
							onClick={() => setIsFolderSectionOpen((prev) => !prev)}
							className="flex items-center gap-1 hover:text-white transition"
							title={isFolderSectionOpen ? "폴더 트리 접기" : "폴더 트리 펼치기"}
						>
							{isFolderSectionOpen ? (
								<ChevronDown className="h-3.5 w-3.5" />
							) : (
								<ChevronRight className="h-3.5 w-3.5" />
							)}
							<span>폴더 트리</span>
						</button>

						{onCreateFolder && isFolderSectionOpen && (
							<button
								type="button"
								onClick={() => setIsCreatingRoot((prev) => !prev)}
								className="text-xs text-neutral-400 hover:text-white"
								title="새 폴더 추가"
							>
								+ 폴더
							</button>
						)}
					</div>

					{isFolderSectionOpen && (
						<div className="flex flex-col gap-1">
							{isCreatingRoot && onCreateFolder && (
								<form onSubmit={handleCreateRootFolder} className="flex items-center gap-1 my-1 px-1">
									<input
										type="text"
										placeholder="새 폴더 이름"
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
										autoFocus
									/>
									<button
										type="button"
										onClick={() => setIsCreatingRoot(false)}
										className="text-[11px] text-neutral-400 hover:text-white px-1"
									>
										취소
									</button>
								</form>
							)}

							{rootFolders.length === 0 && !isCreatingRoot ? (
								<div className="px-2 py-2 text-xs text-neutral-500">
									생성된 폴더가 없습니다.
								</div>
							) : (
								rootFolders.map((f) => renderFolderItem(f))
							)}
						</div>
					)}
				</div>
			) : (
				<div className="mt-auto border-t border-neutral-800/80 pt-4">
					<Link
						href="/admin"
						className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 transition"
					>
						<span>← 대시보드로 돌아가기</span>
					</Link>
				</div>
			)}
		</aside>
	);
}
