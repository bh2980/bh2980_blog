"use client";

import type { Editor } from "@tiptap/core";
import { MessageSquareMore, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { collapseToEnd, PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form";

export const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";

interface TooltipPopoverProps {
	editor: Editor;
}

/**
 * 선택한 텍스트에 `:tooltip[...]{content="..."}` 마크를 적용·수정·해제하는 팝오버(v2 C3a).
 *
 * - 선택이 비어 있고 툴팁 안이 아니면 비활성
 * - 커서가 툴팁 마크 안이면 버튼이 눌린 상태(Toggle pressed)이고 기존 content 수정/해제(extendMarkRange)
 * - IME 안전: Enter는 한글 조합 중(`isComposing`) 무시
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
				<TooltipContent side="bottom">툴팁</TooltipContent>
			</Tooltip>
			<PopoverContent align="center" className="w-80 p-3 text-xs">
				<TooltipForm
					key={String(open)}
					editor={editor}
					active={isActive}
					initial={value}
					onDone={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}

interface TooltipFormProps {
	editor: Editor;
	/** 커서·선택이 이미 툴팁 안이면 true. 설명을 고치고 해제할 수 있다. */
	active: boolean;
	initial: string;
	/** 고칠 툴팁의 범위. 주면 현재 선택 대신 이 범위를 고친다(인라인 버블에서 커서가 툴팁 경계에 있을 때). */
	range?: { from: number; to: number };
	onDone: () => void;
}

/** 툴팁 설명 입력 폼. 상단 서식 도구의 팝오버와 인라인 버블이 함께 쓴다. */
export function TooltipForm({ editor, active, initial, range, onDone }: TooltipFormProps) {
	const id = useId();
	const [value, setValue] = useState(initial);
	const [error, setError] = useState<string | null>(null);

	const handleApply = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) {
			setError("설명을 입력하세요.");
			return;
		}
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range).setMark("cmsTooltip", { content: trimmed });
		else if (active)
			command
				.extendMarkRange("cmsTooltip", { content: editor.getAttributes("cmsTooltip").content })
				.setMark("cmsTooltip", { content: trimmed });
		else command.setMark("cmsTooltip", { content: trimmed });
		collapseToEnd(command).run();
		onDone();
	};

	const handleRemove = () => {
		const { from, to } = editor.state.selection;
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range);
		else command.extendMarkRange("cmsTooltip", { content: editor.getAttributes("cmsTooltip").content });
		command.unsetMark("cmsTooltip").setTextSelection({ from, to }).run();
		onDone();
	};

	return (
		<form onSubmit={handleApply} onKeyDown={submitOnEnter} className="grid gap-3">
			<p className="font-medium">{active ? "툴팁 수정" : "툴팁 넣기"}</p>
			<label htmlFor={`${id}-content`} className="grid gap-1.5 text-xs">
				설명
				<Textarea
					id={`${id}-content`}
					value={value}
					rows={2}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value);
						setError(null);
					}}
					className="min-h-0"
					autoFocus
				/>
			</label>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel="툴팁 해제"
				removeIcon={<X aria-hidden />}
				onRemove={active ? handleRemove : undefined}
				onCancel={onDone}
			/>
		</form>
	);
}
