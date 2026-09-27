"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { ChartPreview, MathPreview, MermaidPreview } from "./preview-renderers";

type PreviewKind = "mermaid" | "chart" | "math";

const KIND_META: Record<PreviewKind, { label: string; placeholder: string }> = {
	mermaid: {
		label: "Mermaid 다이어그램",
		placeholder: "graph TD;\n    A-->B;",
	},
	chart: {
		label: "차트",
		placeholder: 'pie\n  "Apple": 40\n  "Banana": 60',
	},
	math: {
		label: "수식 (KaTeX)",
		placeholder: "E = mc^2",
	},
};

const resolveKind = (typeName: string): PreviewKind => {
	if (typeName === "cmsChart") return "chart";
	if (typeName === "cmsMath") return "math";
	return "mermaid";
};

const PROSEMIRROR_CURSOR_KEYS = new Set([
	"Enter",
	"Tab",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Backspace",
	"Delete",
	"Home",
	"End",
	"PageUp",
	"PageDown",
]);

export function FencePreviewNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
	const kind = resolveKind(node.type.name);
	const meta = KIND_META[kind];
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState<string>(node.attrs.value ?? "");
	const [previewValue, setPreviewValue] = useState<string>(node.attrs.value ?? "");
	const lastCommittedRef = useRef<string>(node.attrs.value ?? "");
	const inputId = useId();
	const isComposingRef = useRef(false);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftRef = useRef<string>(draft);
	draftRef.current = draft;

	const containerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isEditable = editor?.isEditable ?? true;

	const updateRef = useRef(updateAttributes);
	updateRef.current = updateAttributes;

	const commitValue = (val: string) => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		setPreviewValue(val);
		if (val !== lastCommittedRef.current) {
			lastCommittedRef.current = val;
			updateAttributes({ value: val });
		}
	};

	useEffect(() => {
		if (!isComposingRef.current && node.attrs.value !== lastCommittedRef.current) {
			// 바깥 트랜잭션(되돌리기 등)이 값을 바꿨다. 대기 중인 입력 커밋이 새 값을 덮어쓰지 않게 취소한다.
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
			const externalVal = node.attrs.value ?? "";
			lastCommittedRef.current = externalVal;
			setDraft(externalVal);
			setPreviewValue(externalVal);
		}
	}, [node.attrs.value]);

	useEffect(() => {
		return () => {
			if (!debounceTimerRef.current && !isComposingRef.current) return;
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
			// 사라지기 전에 아직 커밋하지 않은 입력을 문서에 넣는다. 노드가 이미 지워졌으면 넣을 곳이 없다.
			if (draftRef.current === lastCommittedRef.current) return;
			try {
				updateRef.current({ value: draftRef.current });
			} catch {
				// 노드가 문서에서 빠진 뒤의 언마운트
			}
		};
	}, []);

	const isOpen = (selected || isEditing) && isEditable;

	const handleClick = () => {
		if (!isEditable) return;
		setIsEditing(true);
		// 노드뷰 클릭 시 textarea로 포커스 이동
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	};

	const handleBlur = (e: React.FocusEvent) => {
		if (containerRef.current?.contains(e.relatedTarget as Node)) {
			return;
		}
		// 블러 시 대기 중인 변경사항 즉시 커밋
		commitValue(draftRef.current);
		setIsEditing(false);
	};

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setDraft(val);
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		// 조합 중에는 compositionend가 최종값을 커밋한다.
		if (isComposingRef.current || (e.nativeEvent as InputEvent).isComposing) return;
		// 약 400ms 디바운스 후 커밋 및 미리보기 갱신
		debounceTimerRef.current = setTimeout(() => {
			if (isComposingRef.current) return;
			commitValue(val);
		}, 400);
	};

	const handleCompositionStart = () => {
		isComposingRef.current = true;
	};

	const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
		isComposingRef.current = false;
		const val = e.currentTarget.value;
		setDraft(val);
		// IME 조합 종료 시 즉시 커밋
		commitValue(val);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.metaKey || e.ctrlKey) {
			// 저장 단축키는 바깥(편집 화면)이 처리한다. 그 전에 대기 중인 입력을 문서에 넣는다.
			if (e.key.toLowerCase() === "s") {
				commitValue(draftRef.current);
				return;
			}
			// 그 밖의 조합(전체 선택·되돌리기·Mac 커서 이동)은 입력 칸 안에서만 동작한다.
			e.stopPropagation();
			return;
		}
		if (PROSEMIRROR_CURSOR_KEYS.has(e.key)) {
			// ProseMirror 커서 조작 키만 전파 차단하여 textarea 고유 동작 유지
			e.stopPropagation();
		}
	};

	const renderPreview = () => {
		switch (kind) {
			case "mermaid":
				return <MermaidPreview value={previewValue} />;
			case "chart":
				return <ChartPreview value={previewValue} />;
			case "math":
				return <MathPreview value={previewValue} />;
		}
	};

	return (
		<NodeViewWrapper
			as="div"
			ref={containerRef}
			data-fence-preview={kind}
			onBlur={handleBlur}
			className={cn(
				"group relative my-4 rounded-md border border-border bg-card p-3 shadow-xs transition-colors",
				isOpen && "ring-2 ring-ring/50",
			)}
		>
			{isOpen ? (
				<div className="space-y-3">
					<div className="flex items-center justify-between border-border/40 border-b pb-1 text-muted-foreground text-xs">
						<span className="font-medium font-mono text-[11px]">{meta.label}</span>
						<span className="text-[10px] text-muted-foreground/70">
							{isEditing ? "편집 중 (바깥 클릭 시 완료)" : "선택됨"}
						</span>
					</div>

					{/* 미리보기 (상단 동시 표시) */}
					<div className="min-h-[40px] rounded-md border border-border/40 bg-background/50 p-2">{renderPreview()}</div>

					{/* 원문 입력 칸 (모노, IME 안전) */}
					<div className="space-y-1">
						<label htmlFor={inputId} className="font-mono text-[11px] text-muted-foreground">
							원문 코드
						</label>
						<textarea
							id={inputId}
							ref={textareaRef}
							value={draft}
							placeholder={meta.placeholder}
							spellCheck={false}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							onChange={handleTextChange}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
							onKeyDown={handleKeyDown}
							className="field-sizing-content min-h-[96px] w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
						/>
					</div>
				</div>
			) : (
				// 선택 안 됐을 때는 미리보기만 표시
				<button
					type="button"
					onClick={handleClick}
					className="w-full cursor-pointer border-0 bg-transparent p-0 text-left font-inherit outline-none"
					aria-label={`${meta.label} 편집`}
				>
					{draft.trim() ? (
						renderPreview()
					) : (
						<div className="rounded border border-border/80 border-dashed p-4 text-center text-muted-foreground text-xs hover:border-foreground/30">
							클릭하여 {meta.label} 입력...
						</div>
					)}
				</button>
			)}
		</NodeViewWrapper>
	);
}
