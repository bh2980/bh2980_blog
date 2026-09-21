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
	AlertCircle,
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

	// Custom Dialog States (Replacing window.alert/prompt/confirm)
	const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string; version: number } | null>(null);
	const [renameInput, setRenameInput] = useState("");
	const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; version: number } | null>(null);
	const [errorDialogMsg, setErrorDialogMsg] = useState<string | null>(null);

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
			setErrorDialogMsg("폴더 생성 실패: " + (err.message || String(err)));
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
			setErrorDialogMsg("하위 폴더 생성 실패: " + (err.message || String(err)));
		}
	};

	const handleConfirmRename = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!renamingFolder || !onRenameFolder) return;
		const trimmed = renameInput.trim();
		if (!trimmed || trimmed === renamingFolder.name) {
			setRenamingFolder(null);
			return;
		}
		try {
			await onRenameFolder(renamingFolder.id, trimmed, renamingFolder.version);
			setRenamingFolder(null);
		} catch (err: any) {
			setErrorDialogMsg("폴더 이름 수정 실패: " + (err.message || String(err)));
		}
	};

	const handleConfirmDelete = async () => {
		if (!deletingFolder || !onDeleteFolder) return;
		try {
			await onDeleteFolder(deletingFolder.id, deletingFolder.version);
			setDeletingFolder(null);
		} catch (err: any) {
			setErrorDialogMsg("폴더 삭제 실패: " + (err.message || String(err)));
		}
	};

	const renderFolderItem = (folder: Folder, isRootLevel: boolean = false) => {
		const isFolderActive = currentFolderId === folder.id;
		const children = getChildren(folder.id);
		const hasChildren = children.length > 0;
		const isExpanded = expandedIds.has(folder.id);
		const isCreatingHere = creatingParentId === folder.id;
		const isRenamingHere = renamingFolder?.id === folder.id;

		return (
			<div key={folder.id} className="flex flex-col">
				<div
					className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition select-none ${
						isFolderActive
							? "bg-neutral-800 text-white font-medium"
							: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
					}`}
				>
					{isRenamingHere ? (
						<form onSubmit={handleConfirmRename} className="flex-1 flex items-center gap-1.5">
							<input
								type="text"
								value={renameInput}
								onChange={(e) => setRenameInput(e.target.value)}
								className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-white focus:outline-none focus:border-neutral-400"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Escape") setRenamingFolder(null);
								}}
							/>
							<button type="submit" className="text-[11px] text-white bg-neutral-700 hover:bg-neutral-600 px-1.5 py-0.5 rounded">
								저장
							</button>
							<button
								type="button"
								onClick={() => setRenamingFolder(null)}
								className="text-[11px] text-neutral-400 hover:text-white px-1"
							>
								취소
							</button>
						</form>
					) : (
						<>
							<div
								className="flex flex-1 items-center gap-1.5 min-w-0 cursor-pointer"
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
								{/* 토글 화살표: 자식이 있을 때만 노출. 1단계(isRootLevel)에서 자식이 없으면 gap(여백)을 전혀 주지 않음 */}
								{hasChildren ? (
									<button
										type="button"
										onClick={(e) => toggleExpand(folder.id, e)}
										className="p-0.5 hover:bg-neutral-700/60 rounded text-neutral-400 hover:text-white transition flex-shrink-0"
									>
										{isExpanded ? (
											<ChevronDown className="h-3 w-3" />
										) : (
											<ChevronRight className="h-3 w-3" />
										)}
									</button>
								) : !isRootLevel ? (
									<span className="w-3.5 flex-shrink-0" />
								) : null}

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
										onClick={(e) => {
											e.stopPropagation();
											setRenamingFolder(folder);
											setRenameInput(folder.name);
										}}
										className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-700/60"
									>
										<Edit2 className="h-3 w-3" />
									</button>
									<button
										type="button"
										title="삭제"
										onClick={(e) => {
											e.stopPropagation();
											setDeletingFolder(folder);
										}}
										className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-700/60"
									>
										<Trash2 className="h-3 w-3" />
									</button>
								</div>
							)}
						</>
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

						{children.map((child) => renderFolderItem(child, false))}
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
								rootFolders.map((f) => renderFolderItem(f, true))
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

			{/* 삭제 확인 모달 (window.confirm 대체) */}
			{deletingFolder && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
					<div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
						<h3 className="text-sm font-semibold text-white mb-2">폴더 삭제 확인</h3>
						<p className="text-xs text-neutral-400 mb-5 leading-relaxed">
							&apos;{deletingFolder.name}&apos; 폴더를 삭제하시겠습니까?<br />
							<span className="text-neutral-500">폴더 안의 하위 글과 하위 폴더는 안전하게 보존됩니다.</span>
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setDeletingFolder(null)}
								className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleConfirmDelete}
								className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition"
							>
								삭제하기
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 에러 알림 모달 (window.alert 대체) */}
			{errorDialogMsg && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
					<div className="w-full max-w-sm rounded-xl border border-red-900/60 bg-neutral-900 p-5 shadow-2xl">
						<div className="flex items-center gap-2 text-red-400 mb-2">
							<AlertCircle className="h-4 w-4" />
							<h3 className="text-sm font-semibold">오류 발생</h3>
						</div>
						<p className="text-xs text-neutral-300 mb-5">{errorDialogMsg}</p>
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => setErrorDialogMsg(null)}
								className="rounded-lg bg-neutral-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 transition"
							>
								확인
							</button>
						</div>
					</div>
				</div>
			)}
		</aside>
	);
}
