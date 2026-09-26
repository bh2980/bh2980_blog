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

export function BlockHandleOverlay({ coords, onMoveUp, onMoveDown, onDuplicate, onDelete }: BlockHandleOverlayProps) {
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
				aria-label="블록 조작 메뉴"
				aria-expanded={menuOpen}
				className="flex h-6 w-6 select-none items-center justify-center rounded font-mono text-neutral-400 text-xs transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
				title="블록 조작"
			>
				⋮⋮
			</button>

			{/* Block Actions Dropdown */}
			{menuOpen && (
				<div className="absolute top-0 left-7 z-50 w-36 space-y-0.5 rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
					<button
						type="button"
						onClick={() => {
							onMoveUp();
							setMenuOpen(false);
						}}
						className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
					>
						<span>↑</span> 위로 이동
					</button>
					<button
						type="button"
						onClick={() => {
							onMoveDown();
							setMenuOpen(false);
						}}
						className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
					>
						<span>↓</span> 아래로 이동
					</button>
					<button
						type="button"
						onClick={() => {
							onDuplicate();
							setMenuOpen(false);
						}}
						className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
					>
						<span>⎘</span> 블록 복제
					</button>
					<div className="my-1 border-neutral-200 border-t dark:border-neutral-800" />
					<button
						type="button"
						onClick={() => {
							onDelete();
							setMenuOpen(false);
						}}
						className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
					>
						<span>✕</span> 삭제
					</button>
				</div>
			)}
		</div>,
		document.body,
	);
}
