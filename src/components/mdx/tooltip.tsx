import type { PropsWithChildren } from "react";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";

export const Tooltip = ({ content, children }: PropsWithChildren<{ content: string }>) => {
	return (
		<TooltipRoot>
			<TooltipTrigger>{children}</TooltipTrigger>
			<TooltipContent>{content}</TooltipContent>
		</TooltipRoot>
	);
};
