"use client";

import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Edit2,
	Folder as FolderIcon,
	FolderOpen,
	Plus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import type { Collection } from "@/cms/services/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
					className={`group flex select-none items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
						isFolderActive
							? "bg-neutral-800 font-medium text-white"
							: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
					}`}
				>
					{isRenamingHere ? (
						<form
							onSubmit={handleConfirmRename}
							className="flex flex-1 items-center gap-1.5"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						>
							<input
								type="text"
								aria-label="폴더 이름 변경"
								value={renameInput}
								onChange={(e) => setRenameInput(e.target.value)}
								className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-white text-xs focus:border-neutral-400 focus:outline-none"
								onKeyDown={(e) => {
									e.stopPropagation();
									if (e.key === "Escape") setRenamingFolder(null);
								}}
							/>
							<button
								type="submit"
								className="rounded bg-neutral-700 px-1.5 py-0.5 text-[11px] text-white hover:bg-neutral-600"
							>
								저장
							</button>
							<button
								type="button"
								onClick={() => setRenamingFolder(null)}
								className="px-1 text-[11px] text-neutral-400 hover:text-white"
							>
								취소
							</button>
						</form>
					) : (
						<>
							{/* biome-ignore lint/a11y/useSemanticElements: contains nested expand control */}
							<div
								role="button"
								tabIndex={0}
								className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
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
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelectFolder?.(folder.id);
									}
								}}
							>
								{/* 토글 화살표: 자식이 있을 때만 노출. 1단계(isRootLevel)에서 자식이 없으면 gap(여백)을 전혀 주지 않음 */}
								{hasChildren ? (
									<button
										type="button"
										onClick={(e) => toggleExpand(folder.id, e)}
										className="flex-shrink-0 rounded p-0.5 text-neutral-400 transition hover:bg-neutral-700/60 hover:text-white"
									>
										{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
									</button>
								) : !isRootLevel ? (
									<span className="w-3.5 flex-shrink-0" />
								) : null}

								{/* 폴더 아이콘 */}
								{isExpanded && hasChildren ? (
									<FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 group-hover:text-neutral-200" />
								) : (
									<FolderIcon className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 group-hover:text-neutral-200" />
								)}

								<span className="truncate font-normal text-xs">{folder.name}</span>
							</div>

							{/* 액션 버튼들 (호버 시 노출) */}
							{onRenameFolder && onDeleteFolder && (
								<div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
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
											className="rounded p-1 text-neutral-400 hover:bg-neutral-700/60 hover:text-white"
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
										className="rounded p-1 text-neutral-400 hover:bg-neutral-700/60 hover:text-white"
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
										className="rounded p-1 text-neutral-400 hover:bg-neutral-700/60 hover:text-red-400"
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
					<div className="mt-0.5 ml-3 flex flex-col gap-1 border-neutral-800 border-l pl-2.5">
						{/* 하위 폴더 생성 인라인 폼 */}
						{isCreatingHere && (
							<form onSubmit={(e) => handleCreateSubFolder(folder.id, e)} className="my-1 flex items-center gap-1 px-1">
								<input
									type="text"
									placeholder="하위 폴더 이름"
									value={subFolderName}
									onChange={(e) => setSubFolderName(e.target.value)}
									className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-white text-xs placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
								/>
								<button
									type="button"
									onClick={() => setCreatingParentId(null)}
									className="px-1 text-[11px] text-neutral-400 hover:text-white"
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
		<aside className="flex w-64 flex-shrink-0 flex-col gap-6 border-neutral-800 border-r bg-neutral-900/60 p-4">
			<div>
				<div className="mb-2 flex items-center justify-between px-2 font-semibold text-neutral-400 text-xs uppercase tracking-wider">
					<span>컬렉션</span>
					<Link href="/admin" className="font-normal text-[10px] text-neutral-500 transition hover:text-neutral-300">
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
									className={`flex items-center justify-between rounded-md px-3 py-2 font-medium text-sm transition ${
										isItemActive
											? "bg-neutral-800 font-semibold text-white"
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
								className={`flex items-center justify-between rounded-md px-3 py-2 font-medium text-sm transition ${
									isItemActive
										? "bg-neutral-800 font-semibold text-white"
										: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
								}`}
							>
								<span>{col.label}</span>
							</Link>
						);
					})}
					<Link
						href="/admin/media"
						className={`mt-1 flex items-center justify-between rounded-md border-neutral-800/80 border-t px-3 py-2 pt-2 font-medium text-sm transition ${
							active === "media"
								? "bg-neutral-800 font-semibold text-white"
								: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
						}`}
					>
						<span>미디어 라이브러리 (Media)</span>
					</Link>
					<Link
						href="/admin/templates"
						className={`flex items-center justify-between rounded-md px-3 py-2 font-medium text-sm transition ${
							active === "templates"
								? "bg-neutral-800 font-semibold text-white"
								: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
						}`}
					>
						<span>본문 템플릿 (Templates)</span>
					</Link>
				</nav>
			</div>

			{folders && onSelectFolder ? (
				<div className="flex-1 overflow-y-auto">
					<div className="mb-2 flex items-center justify-between px-2 font-semibold text-neutral-400 text-xs uppercase tracking-wider">
						<button
							type="button"
							onClick={() => setIsFolderSectionOpen((prev) => !prev)}
							className="flex items-center gap-1 transition hover:text-white"
							title={isFolderSectionOpen ? "폴더 트리 접기" : "폴더 트리 펼치기"}
						>
							{isFolderSectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
							<span>폴더 트리</span>
						</button>

						{onCreateFolder && isFolderSectionOpen && (
							<button
								type="button"
								onClick={() => setIsCreatingRoot((prev) => !prev)}
								className="text-neutral-400 text-xs hover:text-white"
								title="새 폴더 추가"
							>
								+ 폴더
							</button>
						)}
					</div>

					{isFolderSectionOpen && (
						<div className="flex flex-col gap-1">
							{isCreatingRoot && onCreateFolder && (
								<form onSubmit={handleCreateRootFolder} className="my-1 flex items-center gap-1 px-1">
									<input
										type="text"
										placeholder="새 폴더 이름"
										value={newFolderName}
										onChange={(e) => setNewFolderName(e.target.value)}
										className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-white text-xs placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
									/>
									<button
										type="button"
										onClick={() => setIsCreatingRoot(false)}
										className="px-1 text-[11px] text-neutral-400 hover:text-white"
									>
										취소
									</button>
								</form>
							)}

							{rootFolders.length === 0 && !isCreatingRoot ? (
								<div className="px-2 py-2 text-neutral-500 text-xs">생성된 폴더가 없습니다.</div>
							) : (
								rootFolders.map((f) => renderFolderItem(f, true))
							)}
						</div>
					)}
				</div>
			) : (
				<div className="mt-auto border-neutral-800/80 border-t pt-4">
					<Link
						href="/admin"
						className="flex items-center gap-2 rounded-md px-3 py-2 font-medium text-neutral-400 text-xs transition hover:bg-neutral-800/50 hover:text-neutral-200"
					>
						<span>← 대시보드로 돌아가기</span>
					</Link>
				</div>
			)}

			<Dialog open={Boolean(deletingFolder)} onOpenChange={(open) => !open && setDeletingFolder(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>폴더 삭제 확인</DialogTitle>
						<DialogDescription>
							&apos;{deletingFolder?.name}&apos; 폴더를 삭제하시겠습니까? 폴더 안의 하위 글과 하위 폴더는 보존됩니다.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setDeletingFolder(null)}
							className="rounded-lg border px-3 py-1.5 font-medium text-xs"
						>
							취소
						</button>
						<button
							type="button"
							onClick={handleConfirmDelete}
							className="rounded-lg border px-3 py-1.5 font-semibold text-xs"
						>
							삭제하기
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(errorDialogMsg)} onOpenChange={(open) => !open && setErrorDialogMsg(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertCircle className="h-4 w-4" />
							오류 발생
						</DialogTitle>
						<DialogDescription>{errorDialogMsg}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<button
							type="button"
							onClick={() => setErrorDialogMsg(null)}
							className="rounded-lg border px-4 py-1.5 font-semibold text-xs"
						>
							확인
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</aside>
	);
}
