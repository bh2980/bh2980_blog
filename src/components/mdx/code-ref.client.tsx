"use client";

import { ArrowDown, ArrowUp, Code2 } from "lucide-react";
import { type PropsWithChildren, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import {
	buildPreview,
	type CodePreview as CodePreviewData,
	findAnchorLines,
	focusLines,
	isOnScreen,
	prefersReducedMotion,
	revealLines,
} from "./code-ref-dom";
import { useTouchLike } from "./use-touch-like";

/** 코드로 옮겨 간 뒤 읽던 곳으로 돌아갈 위치. 한 번에 하나만 둔다(마지막으로 옮긴 연결이 주인이다). */
type ReturnSpot = { owner: string; y: number } | null;
let returnSpot: ReturnSpot = null;
const returnListeners = new Set<() => void>();
const setReturnSpot = (spot: ReturnSpot) => {
	returnSpot = spot;
	for (const listener of returnListeners) listener();
};
const subscribeReturn = (listener: () => void) => {
	returnListeners.add(listener);
	return () => returnListeners.delete(listener);
};

const FOCUS_MS = 2500;

function CodePreview({ preview }: { preview: CodePreviewData }) {
	return (
		<div className="overflow-hidden rounded-md border">
			{preview.title && (
				<div className="border-b bg-muted px-3 py-1.5 font-medium text-muted-foreground text-xs">{preview.title}</div>
			)}
			<pre
				ref={(element) => element?.setAttribute("style", preview.preStyle)}
				className={cn(preview.preClass, "m-0 max-h-72 overflow-auto rounded-none py-2 text-sm leading-6")}
			>
				<code className="block min-w-fit">
					{preview.rows.map((row) => (
						<div
							key={row.number}
							className={cn("flex pr-4", row.focused ? "bg-primary/10" : "opacity-45")}
							data-preview-line={row.number}
						>
							<span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground">{row.number}</span>
							{/* 공개 코드 블록에서 복제한 줄(서버가 그린 구문 색 span). */}
							{/* biome-ignore lint/security/noDangerouslySetInnerHtml: 같은 페이지의 코드 줄 DOM을 복제한다 */}
							<span dangerouslySetInnerHTML={{ __html: row.html }} />
						</div>
					))}
				</code>
			</pre>
		</div>
	);
}

/**
 * 본문 글자와 코드 줄의 연결(`:code-ref[글자]{to="c1"}`).
 *
 * - 코드가 화면에 보이면: 그 자리에서 연결된 줄을 강조하고 나머지 줄을 흐린다(페이지를 움직이지 않는다).
 * - 화면 밖이면: 데스크톱은 글자 옆 미리보기, 터치 기기는 아래에서 올라오는 시트로 연결된 줄만 보인다.
 * - 코드로 옮기는 것은 읽는 사람이 "코드 전체 보기"를 누를 때만이다. 옮긴 뒤에는 "읽던 곳으로" 버튼이 뜬다.
 * 연결된 줄을 찾지 못하면(지워진 이름표) 연결 없는 글자로 보인다.
 */
export function CodeRef({ to, children }: PropsWithChildren<{ to: string }>) {
	const owner = useId();
	const isTouch = useTouchLike();
	const [broken, setBroken] = useState(false);
	const [preview, setPreview] = useState<CodePreviewData | null>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);
	const clearFocusRef = useRef<(() => void) | null>(null);
	const focusTimerRef = useRef<number | undefined>(undefined);
	const jumpingRef = useRef(false);
	const spot = useSyncExternalStore(
		subscribeReturn,
		() => returnSpot,
		() => null,
	);

	useEffect(() => {
		setBroken(findAnchorLines(to).length === 0);
	}, [to]);

	const clearFocus = useCallback(() => {
		window.clearTimeout(focusTimerRef.current);
		clearFocusRef.current?.();
		clearFocusRef.current = null;
	}, []);

	useEffect(() => clearFocus, [clearFocus]);

	const focus = useCallback(
		(lines: HTMLElement[], timed: boolean) => {
			clearFocus();
			clearFocusRef.current = focusLines(lines);
			if (timed) focusTimerRef.current = window.setTimeout(clearFocus, FOCUS_MS);
		},
		[clearFocus],
	);

	/** 코드로 옮겨 가고, 읽던 곳으로 돌아갈 버튼을 띄운다. */
	const jump = useCallback(() => {
		const lines = findAnchorLines(to);
		if (!lines.length) return;
		setReturnSpot({ owner, y: window.scrollY });
		revealLines(lines);
		focus(lines, true);
	}, [focus, owner, to]);

	// 읽던 곳 가까이로 스스로 돌아오면 버튼을 거둔다(옮겨 가는 동안에는 거두지 않는다).
	const mine = spot?.owner === owner ? spot : null;
	useEffect(() => {
		if (!mine) return;
		let away = false;
		const onScroll = () => {
			const distance = Math.abs(window.scrollY - mine.y);
			if (distance > 300) away = true;
			else if (away && distance < 120) setReturnSpot(null);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [mine]);

	const goBack = () => {
		if (!mine) return;
		window.scrollTo({ top: mine.y, behavior: prefersReducedMotion() ? "auto" : "smooth" });
		setReturnSpot(null);
	};

	/** 누르거나(터치) 클릭했을 때. 보이면 그 자리 강조, 안 보이면 터치는 시트·데스크톱은 코드로 옮긴다. */
	const activate = () => {
		const lines = findAnchorLines(to);
		if (!lines.length) return;
		if (isOnScreen(lines)) {
			focus(lines, true);
			return;
		}
		if (isTouch) {
			setPreview(buildPreview(lines));
			setSheetOpen(true);
			return;
		}
		setPopoverOpen(false);
		jump();
	};

	const returnButton =
		mine && typeof document !== "undefined"
			? createPortal(
					<Button
						type="button"
						size="sm"
						onClick={goBack}
						className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 gap-1 rounded-full shadow-lg"
					>
						{mine.y < window.scrollY ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
						읽던 곳으로
					</Button>,
					document.body,
				)
			: null;

	if (broken) return <>{children}</>;

	const linkText = (
		<>
			{children}
			<Code2 aria-hidden className="ml-0.5 inline size-[0.85em] align-[-0.1em] text-primary" />
		</>
	);
	const linkClass =
		"cursor-pointer rounded-sm underline decoration-primary/50 decoration-solid underline-offset-4 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring/50";
	const common = {
		"data-code-ref": to,
		onClick: activate,
		onKeyDown: (event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				activate();
			}
		},
	};

	if (isTouch) {
		return (
			<>
				{/* biome-ignore lint/a11y/useSemanticElements: 문장 안의 글자라 button 대신 span에 역할을 준다 */}
				<span role="button" tabIndex={0} className={linkClass} {...common}>
					{linkText}
				</span>
				<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
					<SheetContent
						side="bottom"
						// 코드로 옮겨 갈 때는 닫힌 뒤 글자로 초점을 돌리지 않는다(돌리면 페이지가 다시 글자로 움직인다).
						finalFocus={() => !jumpingRef.current}
						className="max-h-[60vh] gap-3 rounded-t-xl p-4 motion-reduce:transition-none"
					>
						<SheetHeader className="p-0">
							<SheetTitle>연결된 코드</SheetTitle>
							<SheetDescription className="sr-only">본문에서 가리킨 코드 줄입니다.</SheetDescription>
						</SheetHeader>
						<div className="min-h-0 overflow-auto">{preview && <CodePreview preview={preview} />}</div>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(false)}>
								닫기
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={() => {
									jumpingRef.current = true;
									setSheetOpen(false);
									// 시트가 닫히고 나서 옮긴다.
									window.setTimeout(() => {
										jumpingRef.current = false;
										jump();
									}, 250);
								}}
							>
								코드 전체 보기
							</Button>
						</div>
					</SheetContent>
				</Sheet>
				{returnButton}
			</>
		);
	}

	return (
		<>
			<Popover
				open={popoverOpen}
				onOpenChange={(next) => {
					if (!next) {
						setPopoverOpen(false);
						return;
					}
					const lines = findAnchorLines(to);
					// 코드가 화면에 보이면 미리보기 대신 그 자리에서 강조한다(마우스를 올린 동안).
					if (!lines.length || isOnScreen(lines)) return;
					setPreview(buildPreview(lines));
					setPopoverOpen(true);
				}}
			>
				<PopoverTrigger
					openOnHover
					delay={200}
					closeDelay={150}
					nativeButton={false}
					render={
						// biome-ignore lint/a11y/useSemanticElements: 문장 안의 글자라 button 대신 span에 역할을 준다
						<span
							role="button"
							tabIndex={0}
							className={linkClass}
							onPointerEnter={(event) => {
								if (event.pointerType !== "mouse") return;
								const lines = findAnchorLines(to);
								if (lines.length && isOnScreen(lines)) focus(lines, false);
							}}
							onPointerLeave={clearFocus}
							onFocus={() => {
								const lines = findAnchorLines(to);
								if (lines.length && isOnScreen(lines)) focus(lines, false);
							}}
							onBlur={clearFocus}
							{...common}
						/>
					}
				>
					{linkText}
				</PopoverTrigger>
				<PopoverContent side="top" align="start" className="w-[min(36rem,calc(100vw-2rem))] gap-2 p-2">
					{preview && <CodePreview preview={preview} />}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="self-end"
						onClick={() => {
							setPopoverOpen(false);
							jump();
						}}
					>
						코드 전체 보기
					</Button>
				</PopoverContent>
			</Popover>
			{returnButton}
		</>
	);
}
