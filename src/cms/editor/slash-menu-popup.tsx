"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SlashCommandItem } from "./slash-command";

interface SlashMenuPopupProps {
	items: SlashCommandItem[];
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: SlashCommandItem) => void;
}

export function SlashMenuPopup({ items, coords, selectedIndex, onSelect }: SlashMenuPopupProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted || items.length === 0) return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top + 24}px`,
				left: `${coords.left}px`,
				zIndex: 9999,
			}}
			className="w-64 max-h-80 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-1 text-xs"
		>
			<div className="px-2 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
				블록 추가
			</div>
			<div className="space-y-0.5">
				{items.map((item, idx) => {
					const isSelected = idx === selectedIndex;
					return (
						<button
							key={item.title}
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
							<span className="font-semibold">{item.title}</span>
							<span className="text-[10px] text-neutral-500 dark:text-neutral-400">{item.description}</span>
						</button>
					);
				})}
			</div>
		</div>,
		document.body,
	);
}
