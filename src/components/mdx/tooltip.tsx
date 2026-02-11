import type { CSSProperties, PropsWithChildren } from "react";
import { cn } from "@/utils/cn";
import { TooltipContent, Tooltip as TooltipRoot, TooltipTrigger } from "../ui/tooltip";

export const Tooltip = ({
	content,
	className,
	children,
	style,
}: PropsWithChildren<{ content: string; className?: string; style?: CSSProperties }>) => {
	return (
		<TooltipRoot>
			<TooltipTrigger
				className={cn("underline decoration-slate-900/30 decoration-dotted dark:decoration-slate-100/30", className)}
			>
				<span style={style}>{children}</span>
			</TooltipTrigger>
			<TooltipContent>{content}</TooltipContent>
		</TooltipRoot>
	);
};
