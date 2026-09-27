"use client";

import { NodeViewContent, type NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { Check, Copy, Info, ListOrdered, MessageSquare, Underline as UnderlineIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CODE_LANGUAGE_OPTIONS } from "./languages";
import { formatMeta, parseMeta } from "./meta";
import type { CodeBlockAnnotationItem } from "./types";

export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
	const [copied, setCopied] = useState(false);
	const [tooltipText, setTooltipText] = useState("");
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const id = useId();
	// NodeView는 선택만 바뀌면 재렌더되지 않는다. 주석 도구 활성 상태는 선택을 구독한다.
	useEditorState({ editor, selector: ({ editor: current }) => current?.state.selection });

	const language = (node.attrs.language as string) || "text";
	const metaString = (node.attrs.meta as string) || "";
	const annotations = (node.attrs.annotations as CodeBlockAnnotationItem[]) || [];
	const annotationsDisabled = Boolean(node.attrs.annotationsDisabled);

	const parsedMeta = parseMeta(metaString);
	const title = parsedMeta.title;
	const showLineNumbers = parsedMeta.showLineNumbers;

	const handleLanguageChange = (val: string | null) => {
		if (val) {
			updateAttributes({ language: val });
		}
	};

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTitle = e.target.value;
		const newMeta = formatMeta({
			title: newTitle,
			showLineNumbers,
			raw: parsedMeta.raw,
		});
		updateAttributes({ meta: newMeta });
	};

	const handleToggleLineNumbers = (pressed: boolean) => {
		const newMeta = formatMeta({
			title,
			showLineNumbers: pressed,
			raw: parsedMeta.raw,
		});
		updateAttributes({ meta: newMeta });
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(node.textContent);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// 클립보드 접근 불가 시 무시
		}
	};

	// 현재 선택 영역이 이 코드 블록 내부인지 판정
	const getSelectionOffsets = (): { from: number; to: number } | null => {
		if (typeof getPos !== "function") return null;
		const pos = getPos();
		if (typeof pos !== "number") return null;
		const blockStart = pos + 1;
		const blockEnd = blockStart + node.textContent.length;
		const { from, to } = editor.state.selection;

		if (from >= blockStart && to <= blockEnd) {
			return {
				from: from - blockStart,
				to: to - blockStart,
			};
		}
		return null;
	};

	const currentOffsets = getSelectionOffsets();
	const hasSelection =
		currentOffsets !== null &&
		currentOffsets.from < currentOffsets.to &&
		!node.textContent.slice(currentOffsets.from, currentOffsets.to).includes("\n");

	// 밑줄 주석 추가 / 제거
	const handleToggleUnderline = () => {
		if (annotationsDisabled || !hasSelection || !currentOffsets) return;

		const { from, to } = currentOffsets;
		// 이미 동일하거나 겹치는 밑줄 주석이 있는지 확인
		const existingIndex = annotations.findIndex(
			(a) => a.type === "underline" && ((a.from <= from && a.to >= to) || (a.from >= from && a.to <= to)),
		);

		let next: CodeBlockAnnotationItem[];
		if (existingIndex >= 0) {
			next = annotations.filter((_, i) => i !== existingIndex);
		} else if (from < to) {
			next = [
				...annotations,
				{
					id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
					type: "underline",
					from,
					to,
				},
			];
		} else {
			return;
		}

		updateAttributes({ annotations: next });
	};

	// 툴팁 주석 적용
	const handleApplyTooltip = () => {
		if (annotationsDisabled || !currentOffsets || !tooltipText.trim()) return;

		const { from, to } = currentOffsets;
		if (from >= to) return;

		const next: CodeBlockAnnotationItem[] = [
			...annotations.filter((a) => !(a.type === "tooltip" && a.from === from && a.to === to)),
			{
				id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				type: "tooltip",
				from,
				to,
				content: tooltipText.trim(),
			},
		];

		updateAttributes({ annotations: next });
		setTooltipText("");
		setTooltipOpen(false);
	};

	// 툴팁 주석 삭제
	const handleRemoveTooltip = () => {
		if (annotationsDisabled || !hasSelection || !currentOffsets) return;
		const { from, to } = currentOffsets;

		const next = annotations.filter(
			(a) => !(a.type === "tooltip" && ((a.from <= from && a.to >= to) || (a.from >= from && a.to <= to))),
		);
		updateAttributes({ annotations: next });
		setTooltipOpen(false);
	};

	return (
		<NodeViewWrapper
			className="group relative my-4 flex w-full flex-col overflow-hidden rounded-md border bg-muted/30 font-mono text-sm shadow-xs"
			data-code-block-wrapper=""
		>
			{/* 상단 바: 언어 선택, 파일명, 줄 번호, 주석 편집 도구, 복사 버튼 */}
			<div
				className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs"
				contentEditable={false}
			>
				<div className="flex flex-wrap items-center gap-2">
					{/* 언어 선택 드롭다운 */}
					<Select value={language} onValueChange={handleLanguageChange}>
						<SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label="코드 언어 선택">
							<SelectValue placeholder="언어 선택" />
						</SelectTrigger>
						<SelectContent>
							{CODE_LANGUAGE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* title (파일명) 입력창 */}
					<Input
						id={`${id}-title`}
						placeholder="파일명 (선택사항)"
						value={title}
						onChange={handleTitleChange}
						className="h-7 w-40 text-xs"
						aria-label="코드 블록 파일명"
					/>
				</div>

				<div className="flex items-center gap-1">
					{/* 주석 편집: 밑줄 */}
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									disabled={annotationsDisabled || !hasSelection}
									onClick={handleToggleUnderline}
									aria-label="선택 영역 밑줄 주석 토글"
									className="size-7"
								>
									<UnderlineIcon className="size-3.5" />
								</Button>
							}
						/>
						<TooltipContent>
							{annotationsDisabled
								? "지원하지 않는 주석 형식이 있어 편집 불가"
								: hasSelection
									? "선택 영역 밑줄 주석"
									: "코드를 선택한 후 밑줄을 추가하세요"}
						</TooltipContent>
					</Tooltip>

					{/* 주석 편집: 툴팁 */}
					<Popover open={tooltipOpen} onOpenChange={setTooltipOpen}>
						<Tooltip>
							<TooltipTrigger
								render={
									<PopoverTrigger
										render={
											<Button
												type="button"
												variant="ghost"
												size="icon-xs"
												disabled={annotationsDisabled || !hasSelection}
												aria-label="선택 영역 툴팁 주석"
												className="size-7"
											>
												<MessageSquare className="size-3.5" />
											</Button>
										}
									/>
								}
							/>
							<TooltipContent>
								{annotationsDisabled
									? "지원하지 않는 주석 형식이 있어 편집 불가"
									: hasSelection
										? "선택 영역 툴팁 설명 주석"
										: "코드를 선택한 후 툴팁을 추가하세요"}
							</TooltipContent>
						</Tooltip>
						<PopoverContent className="w-64 p-3" align="end">
							<div className="flex flex-col gap-2 font-sans text-xs">
								<span className="font-semibold text-foreground">코드 툴팁 설명</span>
								<Input
									placeholder="툴팁 내용 입력..."
									value={tooltipText}
									onChange={(e) => setTooltipText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleApplyTooltip();
										}
									}}
									className="h-7 text-xs"
								/>
								<div className="flex justify-end gap-1">
									<Button type="button" variant="destructive" size="xs" onClick={handleRemoveTooltip}>
										삭제
									</Button>
									<Button type="button" variant="default" size="xs" onClick={handleApplyTooltip}>
										적용
									</Button>
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<Separator orientation="vertical" className="h-4" />

					{/* 줄 번호 표시 토글 */}
					<Tooltip>
						<TooltipTrigger
							render={
								<Toggle
									size="sm"
									pressed={showLineNumbers}
									onPressedChange={handleToggleLineNumbers}
									aria-label="줄 번호 표시 토글"
									className="size-7 p-0 data-[state=on]:bg-accent"
								>
									<ListOrdered className="size-3.5" />
								</Toggle>
							}
						/>
						<TooltipContent>줄 번호 표시</TooltipContent>
					</Tooltip>

					{/* 코드 복사 버튼 */}
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={handleCopy}
									aria-label="코드 복사"
									className="size-7"
								>
									{copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
								</Button>
							}
						/>
						<TooltipContent>{copied ? "복사됨!" : "코드 복사"}</TooltipContent>
					</Tooltip>

					{annotationsDisabled && (
						<Tooltip>
							<TooltipTrigger
								render={
									<div className="flex items-center text-muted-foreground">
										<Info className="size-3.5" />
									</div>
								}
							/>
							<TooltipContent>고급 주석(라인 접기 등)이 포함되어 주석 편집이 보호 모드로 동작합니다.</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>

			{/* 코드 편집 영역 (contentDOM) */}
			<pre className="relative flex overflow-x-auto whitespace-pre p-4 font-mono text-sm leading-relaxed outline-none">
				{showLineNumbers && (
					<span
						contentEditable={false}
						aria-hidden="true"
						style={{ whiteSpace: "pre" }}
						className="mr-4 select-none border-border border-r pr-2 text-right text-muted-foreground"
					>
						{Array.from({ length: node.textContent.split("\n").length }, (_, index) => index + 1).join("\n")}
					</span>
				)}
				<NodeViewContent<"code"> as="code" className="block min-w-fit flex-1 outline-none" />
			</pre>
		</NodeViewWrapper>
	);
}
