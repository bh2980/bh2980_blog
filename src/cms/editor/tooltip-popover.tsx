"use client";

import type { Editor } from "@tiptap/core";
import { MessageSquareMore } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";

interface TooltipPopoverProps {
	editor: Editor;
}

/**
 * 선택한 텍스트에 `:tooltip[...]{content="..."}` 마크를 적용·수정·제거하는 팝오버(v2 C3a).
 *
 * - 선택이 비어 있고 툴팁 안이 아니면 비활성
 * - 커서가 툴팁 마크 안이면 버튼이 눌린 상태(Toggle pressed)이고 기존 content 수정/제거(extendMarkRange)
 * - IME 안전: Input 컴포넌트를 쓰고 Enter는 조합 중(`isComposing`) 무시
 */
export function TooltipPopover({ editor }: TooltipPopoverProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");

	const isActive = editor.isActive("cmsTooltip");
	const disabled = !editor.isEditable || (editor.state.selection.empty && !isActive);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (disabled && nextOpen) return;
			if (nextOpen) {
				const existing = (editor.getAttributes("cmsTooltip").content as string) || "";
				setValue(existing);
			}
			setOpen(nextOpen);
		},
		[disabled, editor],
	);

	useEffect(() => {
		const onOpenTooltip = () => {
			if (!editor.isEditable) return;
			const active = editor.isActive("cmsTooltip");
			if (editor.state.selection.empty && !active) return;
			const existing = (editor.getAttributes("cmsTooltip").content as string) || "";
			setValue(existing);
			setOpen(true);
		};
		window.addEventListener(OPEN_TOOLTIP_EVENT, onOpenTooltip);
		return () => window.removeEventListener(OPEN_TOOLTIP_EVENT, onOpenTooltip);
	}, [editor]);

	const handleApply = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed) return;
		if (isActive) {
			editor
				.chain()
				.focus()
				.extendMarkRange("cmsTooltip", { content: editor.getAttributes("cmsTooltip").content })
				.setMark("cmsTooltip", { content: trimmed })
				.run();
		} else {
			editor.chain().focus().setMark("cmsTooltip", { content: trimmed }).run();
		}
		setOpen(false);
	}, [editor, isActive, value]);

	const handleRemove = useCallback(() => {
		editor
			.chain()
			.focus()
			.extendMarkRange("cmsTooltip", { content: editor.getAttributes("cmsTooltip").content })
			.unsetMark("cmsTooltip")
			.run();
		setOpen(false);
	}, [editor]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		const isComposing =
			event.nativeEvent.isComposing ||
			(event as unknown as { isComposing?: boolean }).isComposing ||
			event.key === "Process" ||
			event.keyCode === 229;
		if (isComposing) {
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			handleApply();
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Toggle
									size="sm"
									pressed={isActive}
									disabled={disabled}
									aria-label="툴팁"
									onMouseDown={(event) => event.preventDefault()}
									className="size-8 p-0"
								/>
							}
						>
							<MessageSquareMore className="size-4" aria-hidden />
						</PopoverTrigger>
					}
				/>
				<TooltipContent side="bottom">툴팁 (설명)</TooltipContent>
			</Tooltip>
			<PopoverContent align="center" className="flex w-72 flex-col gap-3 p-3 text-xs">
				<PopoverHeader>
					<PopoverTitle className="font-semibold text-xs">
						{isActive ? "툴팁 설명 수정" : "툴팁 설명 입력"}
					</PopoverTitle>
					<PopoverDescription className="text-[11px] text-muted-foreground">
						텍스트 위에 표시할 부가 설명(content)을 입력하세요.
					</PopoverDescription>
				</PopoverHeader>
				<div className="flex flex-col gap-2">
					<Input
						value={value}
						onChange={(event) => setValue(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="설명을 입력하세요"
						className="h-8 text-xs"
						autoFocus
					/>
					<div className="flex items-center justify-end gap-1.5 pt-1">
						{isActive && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="text-destructive hover:text-destructive"
								onClick={handleRemove}
							>
								제거
							</Button>
						)}
						<Button type="button" variant="outline" size="xs" onClick={() => setOpen(false)}>
							취소
						</Button>
						<Button type="button" size="xs" onClick={handleApply} disabled={!value.trim()}>
							적용
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
