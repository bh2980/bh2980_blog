"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Command, CommandGroup, CommandItem, CommandList } from "../ui/command";
import type { SlashCommandItem } from "./slash-command";

interface SlashMenuPopupProps {
	items: SlashCommandItem[];
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: SlashCommandItem) => void;
	onClose: () => void;
}

/**
 * `/` 블록 삽입 메뉴(§4.2). shadcn Command로 그리되 포커스와 방향키는 에디터가 맡고,
 * 강조할 항목만 `value`로 넘긴다(한글 IME 조합 중 포커스를 뺏지 않는다).
 */
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
			className="w-64 rounded-xl border shadow-md"
		>
			<Command value={items[selectedIndex]?.title ?? ""} shouldFilter={false} loop={false}>
				<CommandList className="max-h-80">
					<CommandGroup heading="블록 추가">
						{items.map((item) => (
							<CommandItem
								key={item.title}
								value={item.title}
								onMouseDown={(event) => event.preventDefault()}
								onSelect={() => onSelect(item)}
								className="flex-col items-start gap-0"
							>
								<span className="font-semibold text-xs">{item.title}</span>
								<span className="text-[10px] text-muted-foreground">{item.description}</span>
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
		</section>,
		document.body,
	);
}
