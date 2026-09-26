"use client";

import { createPortal } from "react-dom";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import type { InternalLinkItem } from "./internal-link";

interface InternalLinkPopupProps {
	items: InternalLinkItem[];
	isLoading: boolean;
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: InternalLinkItem) => void;
	onClose: () => void;
}

/** `[[` 내부 글 링크 검색 결과(§6.2). 포커스와 방향키는 에디터가 맡고 강조할 항목만 `value`로 넘긴다. */
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
		<section
			style={{
				position: "fixed",
				top: `${coords.top + 24}px`,
				left: `${coords.left}px`,
				zIndex: 9999,
			}}
			aria-label="내부 글 링크 검색 결과"
			aria-live="polite"
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="w-72 rounded-xl border shadow-md"
		>
			<Command value={items[selectedIndex]?.id ?? ""} shouldFilter={false} loop={false}>
				<div className="flex items-center justify-between px-2 py-1 font-semibold text-[10px] text-muted-foreground">
					<span>내부 글 링크 (`[[`)</span>
					{isLoading && <span>검색 중...</span>}
				</div>
				<CommandList className="max-h-72">
					{!isLoading && <CommandEmpty className="py-3 text-xs">검색 결과가 없습니다</CommandEmpty>}
					<CommandGroup>
						{items.map((item, idx) => (
							<CommandItem
								key={item.id}
								value={item.id}
								aria-current={idx === selectedIndex ? "true" : undefined}
								onMouseDown={(event) => event.preventDefault()}
								onSelect={() => onSelect(item)}
								className="flex-col items-start gap-0"
							>
								<span className="w-full truncate font-semibold text-xs">{item.title}</span>
								<span className="w-full truncate font-mono text-[10px] text-muted-foreground">
									{item.collection === "memo" ? "메모" : "글"} · /{item.slug || "(slug 없음)"}
									{/* 초안 대상 링크는 편집 중 허용하되 표시한다. 발행하려면 대상이 공개되어야 한다(§6.2). */}
									{item.status && item.status !== "published"
										? ` · ${item.status === "draft" ? "초안" : item.status}`
										: ""}
								</span>
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
		</section>,
		document.body,
	);
}
