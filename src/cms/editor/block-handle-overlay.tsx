"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

interface BlockHandleOverlayProps {
	coords: { top: number; left: number };
	onMoveUp: () => void;
	onMoveDown: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}

export function BlockHandleOverlay({
	coords,
	onMoveUp,
	onMoveDown,
	onDuplicate,
	onDelete,
}: BlockHandleOverlayProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	if (typeof window === "undefined") return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top}px`,
				left: `${Math.max(8, coords.left - 32)}px`,
				zIndex: 40,
			}}
			className="group flex items-center"
		>
			{/* Notion-style handle trigger */}
			<button
				type="button"
				onClick={() => setMenuOpen(!menuOpen)}
				className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-xs font-mono select-none"
				title="블록 조작"
			>
				⋮⋮
			</button>

			{/* Block Actions Dropdown */}
			{menuOpen && (
				<div className="absolute left-7 top-0 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-1 text-xs space-y-0.5 z-50">
					<button
						type="button"
						onClick={() => {
							onMoveUp();
							setMenuOpen(false);
						}}
						className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
					>
						<span>↑</span> 위로 이동
					</button>
					<button
						type="button"
						onClick={() => {
							onMoveDown();
							setMenuOpen(false);
						}}
						className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
					>
						<span>↓</span> 아래로 이동
					</button>
					<button
						type="button"
						onClick={() => {
							onDuplicate();
							setMenuOpen(false);
						}}
						className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
					>
						<span>⎘</span> 블록 복제
					</button>
					<div className="border-t border-neutral-200 dark:border-neutral-800 my-1" />
					<button
						type="button"
						onClick={() => {
							onDelete();
							setMenuOpen(false);
						}}
						className="w-full text-left px-2.5 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition flex items-center gap-2"
					>
						<span>✕</span> 삭제
					</button>
				</div>
			)}
		</div>,
		document.body,
	);
}
