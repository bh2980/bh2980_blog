import type { PropsWithChildren } from "react";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";

export const Tooltip = ({ content, children }: PropsWithChildren<{ content: string }>) => {
	return (
		<TooltipRoot>
			<TooltipTrigger className="underline decoration-slate-300 decoration-dotted underline-offset-8 dark:decoration-slate-600">
				{children}
			</TooltipTrigger>
			<TooltipContent>{content}</TooltipContent>
		</TooltipRoot>
	);
};
