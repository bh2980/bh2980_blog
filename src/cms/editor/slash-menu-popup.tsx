"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SlashCommandItem } from "./slash-command";

interface SlashMenuPopupProps {
	items: SlashCommandItem[];
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: SlashCommandItem) => void;
	onClose: () => void;
}

export function SlashMenuPopup({ items, coords, selectedIndex, onSelect, onClose }: SlashMenuPopupProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted || items.length === 0) return null;

	return createPortal(
		<section
			style={{
				position: "fixed",
				top: `${coords.top + 24}px`,
				left: `${coords.left}px`,
				zIndex: 9999,
			}}
			aria-label="블록 추가"
			aria-live="polite"
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="max-h-80 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div className="px-2 py-1.5 font-bold text-[10px] text-neutral-400 uppercase tracking-wider">블록 추가</div>
			<div className="space-y-0.5">
				{items.map((item, idx) => {
					const isSelected = idx === selectedIndex;
					return (
						<button
							key={item.title}
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => onSelect(item)}
							className={`flex w-full flex-col rounded px-2.5 py-1.5 text-left transition ${
								isSelected
									? "bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100"
									: "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
							}`}
						>
							<span className="font-semibold">{item.title}</span>
							<span className="text-[10px] text-neutral-500 dark:text-neutral-400">{item.description}</span>
						</button>
					);
				})}
			</div>
		</section>,
		document.body,
	);
}
