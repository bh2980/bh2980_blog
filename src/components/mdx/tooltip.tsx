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
