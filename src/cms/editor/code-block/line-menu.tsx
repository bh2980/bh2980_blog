"use client";

import { Check, ChevronsDownUp, ChevronsUpDown, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import {
	CODE_LINE_EFFECTS,
	COLLAPSE,
	type CodeLineEffect,
	canAddCollapse,
	hasLineEffect,
	newEffectId,
	setLineEffect,
} from "./model";

interface LineMenuProps {
	/** 고른 줄 [start, end). */
	start: number;
	end: number;
	lineEffects: CodeLineEffect[];
	onChange: (next: CodeLineEffect[]) => void;
	onClose: () => void;
	style?: CSSProperties;
}

const ITEM_CLASS =
	"flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50";

interface ItemProps {
	disabled?: boolean;
	title?: string;
	onSelect: () => void;
	children: React.ReactNode;
}

function MenuItem({ disabled, title, onSelect, children }: ItemProps) {
	return (
		<button
			type="button"
			role="menuitem"
			disabled={disabled}
			title={title}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onSelect}
			className={ITEM_CLASS}
		>
			{children}
		</button>
	);
}

function CheckItem({ checked, onSelect, children }: ItemProps & { checked: boolean }) {
	return (
		<button
			type="button"
			role="menuitemcheckbox"
			aria-checked={checked}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onSelect}
			className={ITEM_CLASS}
		>
			{children}
			<Check aria-hidden className={cn("ml-auto size-3.5", !checked && "invisible")} />
		</button>
	);
}

/** 줄 번호 칸에서 고른 줄에 줄 효과(강조·추가·삭제·경고·오류·접기)를 켜고 끄는 메뉴. */
export function LineMenu({ start, end, lineEffects, onChange, onClose, style }: LineMenuProps) {
	const ref = useRef<HTMLDivElement>(null);
	// 고른 범위와 같은 접기, 또는 한 줄만 골랐을 때 그 줄(› 표시가 있는 첫 줄)에서 시작하는 접기(바깥쪽부터).
	const startingHere = lineEffects
		.filter((effect) => effect.name === COLLAPSE && effect.start === start)
		.sort((a, b) => b.end - a.end);
	const collapse =
		startingHere.find((effect) => effect.end === end) ?? (end - start === 1 ? startingHere[0] : undefined);
	const collapseProblem = collapse ? null : canAddCollapse(lineEffects, start, end);

	useEffect(() => {
		const onDown = (event: MouseEvent) => {
			if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [onClose]);

	const setCollapseOpen = (open: boolean) =>
		onChange(
			lineEffects.map((effect) =>
				effect === collapse ? { ...effect, attrs: { ...effect.attrs, open: open || undefined } } : effect,
			),
		);

	return (
		<div
			ref={ref}
			role="menu"
			aria-label={start + 1 === end ? `${start + 1}번째 줄 효과` : `${start + 1}–${end}번째 줄 효과`}
			data-code-ui=""
			contentEditable={false}
			style={style}
			className="absolute z-20 flex w-44 flex-col gap-0.5 rounded-md border bg-popover p-1 font-sans text-popover-foreground shadow-md"
		>
			<div className="flex items-center justify-between px-2 pt-0.5 pb-1 text-muted-foreground text-xs">
				<span>{start + 1 === end ? `${start + 1}번째 줄` : `${start + 1}–${end}번째 줄`}</span>
				<button
					type="button"
					aria-label="닫기"
					onMouseDown={(event) => event.preventDefault()}
					onClick={onClose}
					className="rounded p-0.5 hover:bg-accent"
				>
					<X aria-hidden className="size-3.5" />
				</button>
			</div>
			{CODE_LINE_EFFECTS.map((effect) => {
				const active = hasLineEffect(lineEffects, effect.name, start, end);
				return (
					<CheckItem
						key={effect.name}
						checked={active}
						onSelect={() => onChange(setLineEffect(lineEffects, effect.name, start, end, !active))}
					>
						{effect.label}
					</CheckItem>
				);
			})}
			<div aria-hidden className="my-0.5 h-px bg-border" />
			{collapse ? (
				<>
					<MenuItem onSelect={() => onChange(lineEffects.filter((effect) => effect !== collapse))}>
						<ChevronsUpDown aria-hidden className="size-3.5" />
						접기 풀기
						<span className="ml-auto text-muted-foreground">
							{collapse.start + 1}–{collapse.end}줄
						</span>
					</MenuItem>
					<CheckItem
						checked={collapse.attrs.open === true}
						onSelect={() => setCollapseOpen(collapse.attrs.open !== true)}
					>
						처음부터 펼쳐 두기
					</CheckItem>
				</>
			) : (
				<MenuItem
					disabled={!!collapseProblem}
					title={collapseProblem ?? "첫 줄만 보이고 나머지는 접힙니다"}
					onSelect={() =>
						onChange(
							[...lineEffects, { id: newEffectId(), name: COLLAPSE, start, end, attrs: {} } as CodeLineEffect].sort(
								(a, b) => a.start - b.start || b.end - a.end,
							),
						)
					}
				>
					<ChevronsDownUp aria-hidden className="size-3.5" />이 줄들 접기
				</MenuItem>
			)}
		</div>
	);
}
