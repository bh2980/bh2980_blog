"use client";

import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface BlockHandleOverlayProps {
	coords: { top: number; left: number };
	onMoveUp: () => void;
	onMoveDown: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
	onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
	/** 손잡이 옆에 붙는 동작 버튼(번역 등). */
	actions?: ReadonlyArray<{ id: string; label: string; icon: React.ReactNode; busy: boolean; onClick: () => void }>;
}

/** 블록 왼쪽의 ⋮⋮ 핸들과 블록 메뉴(§4.2). 메뉴는 shadcn DropdownMenu(Base UI 기반 render prop)라 키보드로도 조작하며, 핸들을 끌어 블록을 드래그 이동한다. */
export function BlockHandleOverlay({
	coords,
	onMoveUp,
	onMoveDown,
	onDuplicate,
	onDelete,
	onDragStart,
	onDragEnd,
	actions = [],
}: BlockHandleOverlayProps) {
	const [open, setOpen] = useState(false);
	if (typeof window === "undefined") return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top}px`,
				// 동작 버튼이 있으면 그만큼 왼쪽으로 더 내어 손잡이 자리를 지킨다.
				left: `${Math.max(8, coords.left - 32 - actions.length * 24)}px`,
				zIndex: 40,
			}}
			className="flex items-center"
		>
			{actions.map((action) => (
				<Tooltip key={action.id}>
					<TooltipTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								aria-label={action.label}
								disabled={action.busy}
								onClick={action.onClick}
								className="text-muted-foreground hover:text-foreground"
							/>
						}
					>
						{action.busy ? <Spinner className="size-3" /> : action.icon}
					</TooltipTrigger>
					<TooltipContent side="bottom">{action.label}</TooltipContent>
				</Tooltip>
			))}
			{/* 모달이 아니어야 한다: 핸들을 누르면 메뉴가 열리는데, 모달 배경이 dragover·drop을 가로채면 드래그가 끝나지 않는다. */}
			<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							draggable
							onDragStart={(event) => {
								// 누를 때 열린 메뉴는 끌기 시작하면 닫는다.
								setOpen(false);
								onDragStart?.(event);
							}}
							onDragEnd={onDragEnd}
							aria-label="블록 조작 메뉴"
							title="블록 조작 (드래그하여 이동)"
							className="cursor-grab text-muted-foreground active:cursor-grabbing"
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
