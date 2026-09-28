"use client";

import type { Editor } from "@tiptap/core";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

export interface ToolbarItem {
	label: string;
	title?: string;
	className?: string;
	isActive?: (editor: Editor) => boolean;
	isDisabled?: (editor: Editor) => boolean;
	run: (editor: Editor) => void;
}

/** 서식 도구·표 도구의 버튼. 누를 때 편집기 선택을 빼앗지 않는다. */
export function ToolbarButton({ editor, item }: { editor: Editor; item: ToolbarItem }) {
	const active = item.isActive?.(editor) ?? false;
	const disabled = !editor.isEditable || (item.isDisabled?.(editor) ?? false);
	const label = item.title ?? item.label;
	const common = {
		"aria-label": label,
		disabled,
		// 버튼 클릭이 편집기 선택을 빼앗지 않게 한다.
		onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
		className: cn("h-7 min-w-7 px-2 text-xs", item.className),
	};
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					item.isActive ? (
						<Toggle size="sm" pressed={active} onPressedChange={() => item.run(editor)} {...common} />
					) : (
						<Button type="button" variant="ghost" size="sm" onClick={() => item.run(editor)} {...common} />
					)
				}
			>
				{item.label}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
