"use client";

import { charEffectByName } from "@bh2980/cms/code-block";
import { type Editor, posToDOMRect } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
	Baseline,
	ChevronsLeftRightEllipsis,
	Code2,
	Eye,
	EyeOff,
	Link2,
	MessageSquareMore,
	Pencil,
	Regex,
	Unlink,
	X,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { codeEffectsKey, expandRule, removeRule, setFoldOpen } from "./code-block/effects-plugin";
import { findAnchor, startLinkFromText, unlinkRef } from "./code-block/link-commands";
import { COLOR_MARK_NAME } from "./color-mark";
import { TextColorPanel } from "./color-menu";
import {
	type ActiveCodeRule,
	type ActiveInlineMark,
	allowedMarkTools,
	allowsMark,
	INLINE_MARK_TOOLS,
	type InlineBubbleTarget,
	inlineBubbleTarget,
	removeInlineMark,
} from "./inline-marks";
import { type LinkDraft, LinkForm, linkDraftFromSelection } from "./link-form";
import { ToolbarButton } from "./toolbar-button";
import { TooltipForm } from "./tooltip-popover";

type Panel =
	| { kind: "link"; draft: LinkDraft }
	| { kind: "color" }
	| { kind: "tooltip"; active: boolean; initial: string; range?: { from: number; to: number } };

const GAP = 8;
const EDGE = 8;

function BubbleButton({
	label,
	onClick,
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label={label}
						// 누를 때 편집기 선택·초점을 빼앗지 않는다.
						onMouseDown={(event) => event.preventDefault()}
						onClick={onClick}
						className={cn("h-8 min-w-8 px-1.5", className)}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent side="top">{label}</TooltipContent>
		</Tooltip>
	);
}

/** 버블을 붙일 화면 영역. 설정이 있는 효과(링크·툴팁)는 그 범위에, 나머지는 커서에 붙인다. */
function anchorRange(target: InlineBubbleTarget): { from: number; to: number } {
	if (target.kind === "selection") return target;
	const primary = target.marks[0];
	if (primary && ["link", "codeRef", "cmsTooltip"].includes(primary.name)) return primary;
	const rule = target.rules[0];
	if (!primary && rule) return rule;
	return { from: target.pos, to: target.pos };
}

/**
 * 본문 글자 위에 뜨는 인라인 효과 버블.
 * - 글자를 끌어 고르면: 굵게·기울임 등 효과와 툴팁·링크를 바로 적용하는 도구.
 * - 커서를 효과 안에 두면: 걸친 효과와 삭제 버튼, 링크 주소·툴팁 설명과 수정 버튼.
 * 링크·툴팁 수정은 버블 안에서 입력 폼으로 펼친다(상단 서식 도구까지 가지 않아도 된다).
 */
export function InlineBubble({ editor }: { editor: Editor }) {
	const snapshot = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current?.isEditable) return null;
			const target = inlineBubbleTarget(current.state);
			// 선택 도구의 눌림 표시가 효과를 적용한 뒤에도 맞도록 적용 상태를 함께 본다.
			const active =
				target?.kind === "selection"
					? [...INLINE_MARK_TOOLS.map((tool) => tool.mark), "link", "cmsTooltip", "codeFold"].filter((mark) =>
							current.isActive(mark),
						)
					: [];
			// 글자 접기의 열림 상태(코드 블록)도 버블에 보인다.
			const folds = codeEffectsKey.getState(current.state)?.version ?? 0;
			return { target, focused: current.isFocused, active, folds };
		},
	});
	const [panel, setPanel] = useState<Panel | null>(null);
	// 누른 채 끄는 동안(글자 선택 중)과 글자를 입력하는 동안에는 숨긴다.
	const [pointerDown, setPointerDown] = useState(false);
	const [typing, setTyping] = useState(false);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const [, setScrollTick] = useState(0);

	const target = snapshot?.target ?? null;
	const visible =
		target !== null &&
		(panel !== null || (!!snapshot?.focused && !pointerDown && !(typing && target.kind === "marks")));

	useEffect(() => {
		const onTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (transaction.docChanged && editor.state.selection.empty) setTyping(true);
			else if (transaction.selectionSet && !transaction.docChanged) setTyping(false);
		};
		const dom = editor.view.dom;
		const onPointerDown = (event: MouseEvent) => {
			if (event.button === 0) setPointerDown(true);
		};
		const onPointerUp = () => setPointerDown(false);
		editor.on("transaction", onTransaction);
		dom.addEventListener("mousedown", onPointerDown);
		window.addEventListener("mouseup", onPointerUp);
		return () => {
			editor.off("transaction", onTransaction);
			dom.removeEventListener("mousedown", onPointerDown);
			window.removeEventListener("mouseup", onPointerUp);
		};
	}, [editor]);

	// 입력 폼을 연 채 버블 바깥을 누르면 폼을 닫는다(팝오버와 같게).
	useEffect(() => {
		if (!panel) return;
		const onDown = (event: MouseEvent) => {
			const bubble = bubbleRef.current;
			if (bubble && event.target instanceof Node && !bubble.contains(event.target)) setPanel(null);
		};
		document.addEventListener("mousedown", onDown, true);
		return () => document.removeEventListener("mousedown", onDown, true);
	}, [panel]);

	useEffect(() => {
		if (!target && panel) setPanel(null);
	}, [target, panel]);

	// 스크롤·창 크기 변경에도 글자를 따라간다(버블은 화면 고정 위치로 띄운다).
	useEffect(() => {
		if (!visible) return;
		const update = () => setScrollTick((tick) => tick + 1);
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [visible]);

	useLayoutEffect(() => {
		if (!visible || !target) {
			setPosition(null);
			return;
		}
		let rect: DOMRect;
		try {
			const range = anchorRange(target);
			rect = posToDOMRect(editor.view, range.from, range.to);
		} catch {
			setPosition(null);
			return;
		}
		const bubble = bubbleRef.current;
		const height = bubble?.offsetHeight ?? 36;
		const width = bubble?.offsetWidth ?? 0;
		// 위쪽 서식 도구(sticky)에 가리지 않게 한다. 위에 자리가 없으면 글자 아래에 띄운다.
		const formatBar = editor.view.dom
			.closest("[data-cms-editor-shell]")
			?.querySelector('[role="toolbar"][aria-label="서식 도구"]');
		const minTop = (formatBar?.getBoundingClientRect().bottom ?? 0) + GAP;
		if (rect.bottom < minTop || rect.top > window.innerHeight) {
			setPosition(null);
			return;
		}
		const above = rect.top - height - GAP;
		const top = above >= minTop ? above : rect.bottom + GAP;
		const center = (rect.left + rect.right) / 2;
		const left = Math.max(EDGE, Math.min(center - width / 2, window.innerWidth - width - EDGE));
		setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
	});

	if (!visible || !target || typeof window === "undefined") return null;

	// 버블에서 효과를 지우면 문서가 바뀌지만 입력이 아니므로 버블을 계속 보인다.
	const act = (action: () => void) => () => {
		action();
		setTyping(false);
	};

	const closePanel = () => {
		setPanel(null);
		setTyping(false);
		editor.commands.focus();
	};

	const openLink = (draft: LinkDraft) => setPanel({ kind: "link", draft });
	const openTooltip = (mark?: ActiveInlineMark) =>
		setPanel(
			mark
				? { kind: "tooltip", active: true, initial: String(mark.attrs.content ?? ""), range: mark }
				: {
						kind: "tooltip",
						active: editor.isActive("cmsTooltip"),
						initial: String(editor.getAttributes("cmsTooltip").content ?? ""),
					},
		);

	const renderMark = (mark: ActiveInlineMark) => {
		if (mark.name === "link") {
			const href = String(mark.attrs.href ?? "");
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<Link2 aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
					<a
						href={href}
						target="_blank"
						rel="noreferrer noopener"
						title={`${href} (새 탭에서 열기)`}
						// 누를 때 편집기 초점을 빼앗으면 버블이 먼저 사라져 링크가 열리지 않는다.
						onMouseDown={(event) => event.preventDefault()}
						className="max-w-56 truncate px-1 text-primary text-xs underline underline-offset-2"
					>
						{href}
					</a>
					<BubbleButton
						label="링크 수정"
						onClick={() => openLink({ from: mark.from, to: mark.to, existing: true, href })}
					>
						<Pencil aria-hidden className="size-4" />
					</BubbleButton>
					<BubbleButton label="링크 제거" onClick={act(() => removeInlineMark(editor, mark))}>
						<Unlink aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		if (mark.name === "cmsTooltip") {
			const content = String(mark.attrs.content ?? "");
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<MessageSquareMore aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
					<span className="max-w-48 truncate px-1 text-muted-foreground text-xs" title={content}>
						{content}
					</span>
					<BubbleButton label="툴팁 설명 수정" onClick={() => openTooltip(mark)}>
						<Pencil aria-hidden className="size-4" />
					</BubbleButton>
					<BubbleButton label="툴팁 제거" onClick={act(() => removeInlineMark(editor, mark))}>
						<X aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		if (mark.name === "codeRef") {
			const anchor = findAnchor(editor.state.doc, String(mark.attrs.to ?? ""));
			const where = anchor
				? `${anchor.title ? `${anchor.title} ` : ""}${anchor.end - anchor.start === 1 ? `${anchor.start + 1}줄` : `${anchor.start + 1}–${anchor.end}줄`}`
				: null;
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<Code2 aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
					<span className={cn("max-w-56 truncate px-1 text-xs", where ? "text-muted-foreground" : "text-destructive")}>
						{where ? `코드 ${where}` : "연결된 코드 줄이 없습니다"}
					</span>
					<BubbleButton
						label="코드 다시 연결"
						className="text-xs"
						onClick={act(() => startLinkFromText(editor.view, mark.from, mark.to))}
					>
						다시 연결
					</BubbleButton>
					<BubbleButton label="코드 연결 끊기" onClick={act(() => unlinkRef(editor.view, mark.from, mark.to))}>
						<Unlink aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		if (mark.name === "codeFold") {
			const region = {
				key: `m:${mark.from}`,
				kind: "fold" as const,
				from: mark.from,
				to: mark.to,
				defaultOpen: true,
				hiddenLines: 0,
			};
			const open = codeEffectsKey.getState(editor.state)?.overrides.get(region.key) ?? region.defaultOpen;
			const publicOpen = mark.attrs.open === true;
			const type = editor.schema.marks.codeFold;
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<ChevronsLeftRightEllipsis aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
					<span className="px-1 text-muted-foreground text-xs">글자 접기</span>
					<BubbleButton
						label={open ? "접어 보기" : "펼쳐 보기"}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
					</BubbleButton>
					<BubbleButton
						label={publicOpen ? "공개 글에서 처음엔 접어 두기" : "공개 글에서 처음부터 펼쳐 두기"}
						className={cn("text-xs", publicOpen && "bg-muted")}
						onClick={act(() => {
							if (!type) return;
							editor
								.chain()
								.focus()
								.command(({ tr }) => {
									tr.addMark(mark.from, mark.to, type.create({ open: !publicOpen }));
									return true;
								})
								.run();
						})}
					>
						처음부터 펼침
					</BubbleButton>
					<BubbleButton label="글자 접기 해제" onClick={act(() => removeInlineMark(editor, mark))}>
						<X aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		const tool = INLINE_MARK_TOOLS.find((item) => item.mark === mark.name);
		if (!tool) return null;
		return (
			<BubbleButton
				key={mark.name}
				label={`${tool.title ?? tool.label} 해제`}
				onClick={act(() => removeInlineMark(editor, mark))}
				className="gap-0.5"
			>
				<tool.icon aria-hidden className="size-4" />
				<X aria-hidden className="size-3 text-muted-foreground" />
			</BubbleButton>
		);
	};

	/** 정규식 규칙이 찾은 곳. 규칙이라 이 곳만 지울 수 없다 — 규칙째 지우거나, 개별 효과로 풀어 하나씩 지운다. */
	const renderRule = ({ rule, blockPos, from, to, count }: ActiveCodeRule) => {
		const label = charEffectByName(rule.name)?.label ?? rule.name;
		const region = { key: `m:${from}`, kind: "fold" as const, from, to, defaultOpen: true, hiddenLines: 0 };
		const open = codeEffectsKey.getState(editor.state)?.overrides.get(region.key) ?? true;
		return (
			<div key={rule.id} className="flex items-center gap-0.5">
				<Regex aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
				<span className="max-w-48 truncate px-1 text-muted-foreground text-xs" title={`/${rule.pattern}/${rule.flags}`}>
					{label} 규칙 · {count}곳
				</span>
				{rule.name === "fold" && (
					<BubbleButton
						label={open ? "접어 보기" : "펼쳐 보기"}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
					</BubbleButton>
				)}
				<BubbleButton
					label="개별 효과로 바꾸기"
					className="text-xs"
					onClick={act(() => expandRule(editor.view, blockPos, rule.id))}
				>
					개별로
				</BubbleButton>
				<BubbleButton label="규칙 삭제" onClick={act(() => removeRule(editor.view, blockPos, rule.id))}>
					<X aria-hidden className="size-4" />
				</BubbleButton>
			</div>
		);
	};

	const renderMarks = (marks: ActiveInlineMark[], rules: ActiveCodeRule[]) => {
		const detailed = marks.filter((mark) => ["link", "codeRef", "cmsTooltip", "codeFold"].includes(mark.name));
		const simple = marks.filter((mark) => !detailed.includes(mark));
		const groups = [
			...detailed.map((mark) => <Fragment key={mark.name}>{renderMark(mark)}</Fragment>),
			...rules.map(renderRule),
			...(simple.length ? [<Fragment key="simple">{simple.map(renderMark)}</Fragment>] : []),
		];
		return groups.map((group, index) => (
			<div key={group.key} className="flex items-center gap-0.5">
				{index > 0 && <Separator orientation="vertical" className="mx-0.5 h-4" />}
				{group}
			</div>
		));
	};

	// 코드 블록에서는 그 블록이 받는 효과(굵게·기울임·취소선·밑줄·툴팁)와 글자 접기만 보인다.
	const inCode = !!editor.state.selection.$from.parent.type.spec.code;
	let hasCodeBlock = false;
	editor.state.doc.descendants((node) => {
		if (node.type.name === "codeBlock") hasCodeBlock = true;
		return !hasCodeBlock;
	});
	const renderSelectionTools = () => (
		<>
			{allowedMarkTools(editor.state).map((item) => (
				<ToolbarButton key={item.mark} editor={editor} item={item} tooltipSide="top" />
			))}
			{!inCode && allowsMark(editor.state, COLOR_MARK_NAME) && (
				<BubbleButton label="글자색" onClick={() => setPanel({ kind: "color" })}>
					<Baseline aria-hidden className="size-4" />
				</BubbleButton>
			)}
			<Separator orientation="vertical" className="mx-0.5 h-4" />
			{allowsMark(editor.state, "cmsTooltip") && (
				<BubbleButton
					label={editor.isActive("cmsTooltip") ? "툴팁 설명 수정" : "툴팁 추가"}
					onClick={() => openTooltip()}
				>
					<MessageSquareMore aria-hidden className="size-4" />
				</BubbleButton>
			)}
			{allowsMark(editor.state, "link") && !inCode && (
				<BubbleButton
					label={editor.isActive("link") ? "링크 수정" : "링크 삽입"}
					onClick={() => openLink(linkDraftFromSelection(editor))}
				>
					<Link2 aria-hidden className="size-4" />
				</BubbleButton>
			)}
			{!inCode && allowsMark(editor.state, "codeRef") && hasCodeBlock && (
				<BubbleButton
					label="코드와 잇기"
					onClick={() => {
						const { from, to } = editor.state.selection;
						startLinkFromText(editor.view, from, to);
					}}
				>
					<Code2 aria-hidden className="size-4" />
				</BubbleButton>
			)}
			{inCode && allowsMark(editor.state, "codeFold") && (
				<BubbleButton
					label="글자 접기"
					className={cn(editor.isActive("codeFold") && "bg-muted")}
					onClick={() => editor.chain().focus().toggleMark("codeFold").run()}
				>
					<ChevronsLeftRightEllipsis aria-hidden className="size-4" />
				</BubbleButton>
			)}
		</>
	);

	const style = { position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 40 } as const;
	const surface = "rounded-md border bg-popover/95 text-popover-foreground shadow-md backdrop-blur";

	return createPortal(
		panel ? (
			<div
				ref={bubbleRef}
				role="dialog"
				aria-label={panel.kind === "link" ? "링크 편집" : panel.kind === "color" ? "글자색" : "툴팁 편집"}
				data-cms-inline-bubble
				style={style}
				className={cn(surface, "flex flex-col gap-3 p-3 text-xs", panel.kind === "color" ? "w-auto p-2" : "w-80")}
				onKeyDown={(event) => {
					if (event.key === "Escape" && !event.nativeEvent.isComposing) {
						event.preventDefault();
						closePanel();
					}
				}}
			>
				{panel.kind === "link" ? (
					<LinkForm editor={editor} draft={panel.draft} onDone={closePanel} />
				) : panel.kind === "color" ? (
					<TextColorPanel editor={editor} onPicked={closePanel} />
				) : (
					<TooltipForm
						editor={editor}
						active={panel.active}
						initial={panel.initial}
						range={panel.range}
						onDone={closePanel}
					/>
				)}
			</div>
		) : (
			<div
				ref={bubbleRef}
				role="toolbar"
				aria-label={target.kind === "selection" ? "인라인 서식" : "인라인 효과"}
				data-cms-inline-bubble
				style={style}
				className={cn(surface, "flex items-center gap-0.5 p-0.5")}
			>
				{target.kind === "selection" ? renderSelectionTools() : renderMarks(target.marks, target.rules)}
			</div>
		),
		document.body,
	);
}
