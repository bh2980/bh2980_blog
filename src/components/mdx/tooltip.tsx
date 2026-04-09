"use client";

import { type CSSProperties, type PropsWithChildren, useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";

const tooltipTriggerClassName = "underline decoration-slate-900/30 decoration-dotted dark:decoration-slate-100/30";

const isTouchLikeViewport = () => {
	if (typeof window === "undefined") {
		return false;
	}

	return window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches;
};

export const Tooltip = ({
	content,
	className,
	children,
	style,
}: PropsWithChildren<{ content: string; className?: string; style?: CSSProperties }>) => {
	const [isTouchLike, setIsTouchLike] = useState(false);

	useEffect(() => {
		const hoverNoneQuery = window.matchMedia("(hover: none)");
		const pointerCoarseQuery = window.matchMedia("(pointer: coarse)");
		const updateTouchLike = () => {
			setIsTouchLike(isTouchLikeViewport());
		};

		updateTouchLike();
		hoverNoneQuery.addEventListener("change", updateTouchLike);
		pointerCoarseQuery.addEventListener("change", updateTouchLike);

		return () => {
			hoverNoneQuery.removeEventListener("change", updateTouchLike);
			pointerCoarseQuery.removeEventListener("change", updateTouchLike);
		};
	}, []);

	const triggerClassName = cn(tooltipTriggerClassName, className);
	const triggerContent = <span style={style}>{children}</span>;

	if (isTouchLike) {
		return (
			<Popover>
				<PopoverTrigger className={triggerClassName}>{triggerContent}</PopoverTrigger>
				<PopoverContent className="w-[min(20rem,calc(100vw-2rem))] px-3 py-2 text-sm leading-6">
					{content}
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<TooltipRoot>
			<TooltipTrigger className={triggerClassName}>{triggerContent}</TooltipTrigger>
			<TooltipContent sideOffset={6} className="text-sm">
				{content}
			</TooltipContent>
		</TooltipRoot>
	);
};
