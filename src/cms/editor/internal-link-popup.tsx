"use client";

import { createPortal } from "react-dom";
import type { InternalLinkItem } from "./internal-link";

interface InternalLinkPopupProps {
	items: InternalLinkItem[];
	isLoading: boolean;
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: InternalLinkItem) => void;
	onClose: () => void;
}

export function InternalLinkPopup({
	items,
	isLoading,
	coords,
	selectedIndex,
	onSelect,
	onClose,
}: InternalLinkPopupProps) {
	if (typeof window === "undefined") return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top + 24}px`,
				left: `${coords.left}px`,
				zIndex: 9999,
			}}
			className="w-72 max-h-72 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xl p-1 text-xs"
		>
			<div className="flex justify-between items-center px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400 font-semibold">
				<span>내부 글 링크 (`[[`)</span>
				{isLoading && <span>검색 중...</span>}
			</div>

			<div className="space-y-0.5 mt-1">
				{items.length === 0 && !isLoading ? (
					<div className="p-3 text-center text-neutral-400">검색 결과가 없습니다</div>
				) : (
					items.map((item, idx) => {
						const isSelected = idx === selectedIndex;
						return (
							<button
								key={item.id}
								type="button"
								onMouseDown={(e) => {
									e.preventDefault();
									onSelect(item);
								}}
								className={`w-full text-left px-2.5 py-1.5 rounded flex flex-col transition ${
									isSelected
										? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100"
										: "hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200"
								}`}
							>
								<span className="font-semibold truncate">{item.title}</span>
								<span className="text-[10px] font-mono text-neutral-400 truncate">/{item.slug}</span>
							</button>
						);
					})
				)}
			</div>
		</div>,
		document.body,
	);
}
