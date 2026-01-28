import type { PropsWithChildren } from "react";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";

export const Tooltip = ({
	content,
	className,
	children,
}: PropsWithChildren<{ content: string; className?: string }>) => {
	return (
		<TooltipRoot>
			<TooltipTrigger className="underline decoration-border decoration-dotted">{children}</TooltipTrigger>
			<TooltipContent className={className}>{content}</TooltipContent>
		</TooltipRoot>
	);
};

export const Tooltip_unstable = ({
	data,
	children,
}: PropsWithChildren<{ data: { content: string; className?: string } }>) => {
	return (
		<TooltipRoot>
			<TooltipTrigger className="underline decoration-border decoration-dotted">{children}</TooltipTrigger>
			<TooltipContent className={data.className}>{data.content}</TooltipContent>
		</TooltipRoot>
	);
};
