"use client";

import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BlockHandleOverlayProps {
	coords: { top: number; left: number };
	onMoveUp: () => void;
	onMoveDown: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
}

/** 블록 왼쪽의 ⋮⋮ 핸들과 블록 메뉴(§4.2). 메뉴는 shadcn DropdownMenu라 키보드로도 조작한다. */
export function BlockHandleOverlay({ coords, onMoveUp, onMoveDown, onDuplicate, onDelete }: BlockHandleOverlayProps) {
	if (typeof window === "undefined") return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top}px`,
				left: `${Math.max(8, coords.left - 32)}px`,
				zIndex: 40,
			}}
			className="flex items-center"
		>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label="블록 조작 메뉴"
							title="블록 조작"
							className="text-muted-foreground"
						/>
					}
				>
					<GripVertical aria-hidden />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" side="right" className="w-56">
					<DropdownMenuItem onClick={onMoveUp}>
						<ArrowUp aria-hidden />
						위로 이동
						<DropdownMenuShortcut>Alt+↑</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onMoveDown}>
						<ArrowDown aria-hidden />
						아래로 이동
						<DropdownMenuShortcut>Alt+↓</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onDuplicate}>
						<Copy aria-hidden />
						블록 복제
						<DropdownMenuShortcut>⇧⌘D</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onClick={onDelete}>
						<Trash2 aria-hidden />
						삭제
						<DropdownMenuShortcut>⇧⌘⌫</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel className="font-normal text-[10px]">
							키보드: Alt+↑/↓ 이동 · Mod+Shift+D 복제 · Mod+Shift+Backspace 삭제
						</DropdownMenuLabel>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>,
		document.body,
	);
}
