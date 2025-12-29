import type { AnnotationHandler } from "codehike/code";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const tooltip: AnnotationHandler = {
	name: "tooltip",
	Inline: ({ children, annotation }) => {
		const { query, data } = annotation;
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger className="underline decoration-dashed">{children}</TooltipTrigger>
					<TooltipContent align="start">{data?.children || query}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	},
};
