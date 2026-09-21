"use client";

import { useState } from "react";
import Link from "next/link";
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
	folders,
	activeNav,
	onSelectCollection,
	onSelectFolder,
	onCreateFolder,
	onRenameFolder,
	onDeleteFolder,
}: SidebarProps) {
	const [newFolderName, setNewFolderName] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const active: AdminNavId = activeNav ?? currentCollection ?? "post";

	const collections: { id: Collection; label: string }[] = [
		{ id: "post", label: "게시글 (Posts)" },
		{ id: "memo", label: "메모 (Memos)" },
		{ id: "category", label: "카테고리 (Categories)" },
		{ id: "tag", label: "태그 (Tags)" },
		{ id: "collection", label: "모음집 (Collections)" },
	];

	// Build folder hierarchy
	const rootFolders = folders ? folders.filter((f) => !f.parentId) : [];
	const getChildren = (parentId: string) => (folders ? folders.filter((f) => f.parentId === parentId) : []);

	const handleCreateFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFolderName.trim() || !onCreateFolder) return;
		try {
			await onCreateFolder(newFolderName.trim(), currentFolderId ?? null);
			setNewFolderName("");
			setIsCreating(false);
		} catch (err) {
			alert("폴더 생성 실패: " + (err instanceof Error ? err.message : String(err)));
		}
	};

	const renderFolderItem = (folder: Folder, depth: number = 0) => {
		const isFolderActive = currentFolderId === folder.id;
		const children = getChildren(folder.id);

		return (
			<div key={folder.id} className="flex flex-col">
				<div
					className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition ${
						isFolderActive
							? "bg-neutral-800 text-white font-medium"
							: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
					}`}
					style={{ paddingLeft: `${depth * 12 + 8}px` }}
				>
					<button
						type="button"
						onClick={() => onSelectFolder?.(folder.id)}
						className="flex flex-1 items-center gap-1.5 truncate text-left"
					>
						<span>📁</span>
						<span className="truncate">{folder.name}</span>
					</button>

					{onRenameFolder && onDeleteFolder && (
						<div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
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
								className="text-[10px] text-neutral-400 hover:text-white px-1"
							>
								수정
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
								className="text-[10px] text-red-400 hover:text-red-300 px-1"
							>
								삭제
							</button>
						</div>
					)}
				</div>

				{children.map((child) => renderFolderItem(child, depth + 1))}
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
						<span>폴더 트리</span>
						{onCreateFolder && (
							<button
								type="button"
								onClick={() => setIsCreating((prev) => !prev)}
								className="text-xs text-neutral-400 hover:text-white"
							>
								+ 폴더
							</button>
						)}
					</div>

					{isCreating && onCreateFolder && (
						<form onSubmit={handleCreateFolder} className="mb-2 px-2">
							<input
								type="text"
								placeholder="새 폴더 이름"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
								className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
								autoFocus
							/>
						</form>
					)}

					<div className="flex flex-col gap-1">
						<button
							type="button"
							onClick={() => onSelectFolder(null)}
							className={`text-left rounded-md px-3 py-1.5 text-xs transition ${
								currentFolderId === null
									? "bg-neutral-800 text-white font-medium"
									: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
							}`}
						>
							📁 전체 항목 (루트)
						</button>

						{rootFolders.map((f) => renderFolderItem(f, 0))}
					</div>
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
