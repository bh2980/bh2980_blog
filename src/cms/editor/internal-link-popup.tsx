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
			className="max-h-72 w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div className="flex items-center justify-between border-neutral-100 border-b px-2 py-1 font-semibold text-[10px] text-neutral-400 dark:border-neutral-800">
				<span>내부 글 링크 (`[[`)</span>
				{isLoading && <span>검색 중...</span>}
			</div>

			<div className="mt-1 space-y-0.5">
				{items.length === 0 && !isLoading ? (
					<div className="p-3 text-center text-neutral-400">검색 결과가 없습니다</div>
				) : (
					items.map((item, idx) => {
						const isSelected = idx === selectedIndex;
						return (
							<button
								key={item.id}
								aria-current={isSelected ? "true" : undefined}
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => onSelect(item)}
								className={`flex w-full flex-col rounded px-2.5 py-1.5 text-left transition ${
									isSelected
										? "bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100"
										: "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
								}`}
							>
								<span className="truncate font-semibold">{item.title}</span>
								<span className="truncate font-mono text-[10px] text-neutral-400">
									{item.collection === "memo" ? "메모" : "글"} · /{item.slug || "(slug 없음)"}
									{/* 초안 대상 링크는 편집 중 허용하되 표시한다. 발행하려면 대상이 공개되어야 한다(§6.2). */}
									{item.status && item.status !== "published"
										? ` · ${item.status === "draft" ? "초안" : item.status}`
										: ""}
								</span>
							</button>
						);
					})
				)}
			</div>
		</section>,
		document.body,
	);
}
