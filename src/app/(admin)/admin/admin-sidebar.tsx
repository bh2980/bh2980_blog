"use client";

import { useState } from "react";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import type { Collection } from "@/cms/services/types";

interface SidebarProps {
	currentCollection: Collection;
	currentFolderId: string | null;
	folders: Folder[];
	onSelectCollection: (col: Collection) => void;
	onSelectFolder: (folderId: string | null) => void;
	onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
}

export function AdminSidebar({
	currentCollection,
	currentFolderId,
	folders,
	onSelectCollection,
	onSelectFolder,
	onCreateFolder,
}: SidebarProps) {
	const [newFolderName, setNewFolderName] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const collections: { id: Collection; label: string }[] = [
		{ id: "post", label: "게시글 (Posts)" },
		{ id: "memo", label: "메모 (Memos)" },
		{ id: "category", label: "카테고리 (Categories)" },
		{ id: "tag", label: "태그 (Tags)" },
		{ id: "collection", label: "모음집 (Collections)" },
	];

	const handleCreateFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFolderName.trim()) return;
		try {
			await onCreateFolder(newFolderName.trim(), currentFolderId);
			setNewFolderName("");
			setIsCreating(false);
		} catch (err) {
			alert("폴더 생성에 실패했습니다: " + (err instanceof Error ? err.message : String(err)));
		}
	};

	return (
		<aside className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900/60 p-4 flex flex-col gap-6">
			<div>
				<div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 px-2">
					컬렉션
				</div>
				<nav className="flex flex-col gap-1">
					{collections.map((col) => {
						const active = currentCollection === col.id;
						return (
							<button
								key={col.id}
								type="button"
								onClick={() => onSelectCollection(col.id)}
								className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
									active
										? "bg-neutral-800 text-white font-semibold"
										: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
								}`}
							>
								<span>{col.label}</span>
							</button>
						);
					})}
				</nav>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 px-2">
					<span>폴더 트리</span>
					<button
						type="button"
						onClick={() => setIsCreating((prev) => !prev)}
						className="text-xs text-neutral-400 hover:text-white"
					>
						+ 폴더
					</button>
				</div>

				{isCreating && (
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

					{folders.map((f) => {
						const active = currentFolderId === f.id;
						return (
							<button
								key={f.id}
								type="button"
								onClick={() => onSelectFolder(f.id)}
								className={`text-left rounded-md px-3 py-1.5 text-xs transition flex items-center gap-1.5 ${
									active
										? "bg-neutral-800 text-white font-medium"
										: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-300"
								}`}
							>
								<span>📂</span>
								<span className="truncate">{f.name}</span>
							</button>
						);
					})}
				</div>
			</div>
		</aside>
	);
}
