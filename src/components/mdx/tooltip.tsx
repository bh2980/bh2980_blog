"use client";

import { type CSSProperties, type PropsWithChildren, useId } from "react";
import { cn } from "@/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";
import { useTouchLike } from "./use-touch-like";

const tooltipTriggerClassName = "underline decoration-slate-900/30 decoration-dotted dark:decoration-slate-100/30";

export const Tooltip = ({
	content,
	className,
	children,
	style,
	note,
}: PropsWithChildren<{
	content: string;
	className?: string;
	style?: CSSProperties;
	/** 코드 안 툴팁의 주석 번호. 터치 기기에서는 툴팁 대신 이 번호를 보이고 설명은 코드 아래 목록에 둔다(`pre`). */
	note?: string | number;
}>) => {
	const isTouchLike = useTouchLike();
	const descriptionId = useId();

	const triggerClassName = cn(tooltipTriggerClassName, className);
	// 번호는 CSS(touch)로만 보인다. 서버 렌더부터 자리를 잡아 두어 터치 기기에서 글자가 밀리지 않는다.
	const noteMark = note ? (
		<sup aria-hidden className="ml-0.5 touch:inline hidden font-sans font-semibold text-[0.7em] text-primary">
			{note}
		</sup>
	) : null;
	const triggerContent = (
		<span style={style}>
			{children}
			{noteMark}
		</span>
	);

	if (isTouchLike && note) {
		return (
			<span className={triggerClassName}>
				{triggerContent}
				<span className="sr-only">{`주석 ${note}: ${content}`}</span>
			</span>
		);
	}

	if (isTouchLike) {
		return (
			<Popover>
				<PopoverTrigger className={triggerClassName}>{triggerContent}</PopoverTrigger>
				<PopoverContent className="w-fit max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2 text-sm leading-6">
					{content}
				</PopoverContent>
			</Popover>
		);
	}

	// Base UI Tooltip은 role="tooltip"·aria-describedby를 붙이지 않는다. 설명을 스크린 리더도 읽도록 숨긴 텍스트로 연결한다.
	return (
		<TooltipRoot>
			<TooltipTrigger className={triggerClassName} aria-describedby={descriptionId}>
				{triggerContent}
			</TooltipTrigger>
			<span id={descriptionId} className="sr-only">
				{content}
			</span>
			<TooltipContent sideOffset={6} className="text-sm" aria-hidden>
				{content}
			</TooltipContent>
		</TooltipRoot>
	);
};
