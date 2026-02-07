import { ChevronRight } from "lucide-react";
import { Children, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { CollapsibleContent, Collapsible as CollapsibleRoot, CollapsibleTrigger } from "../ui/collapsible";

const CodeBlockCollapsiblePreview = ({ children }: { children: ReactNode }) => {
	const childNodes = Children.toArray(children);
	const firstLine = childNodes[0] ?? null;
	const restLines = childNodes.slice(1);

	if (typeof restLines[0] === "string" && restLines[0].startsWith("\n")) {
		const trimmed = restLines[0].slice(1);
		restLines[0] = trimmed;
		if (trimmed.length === 0) {
			restLines.shift();
		}
	}

	return (
		<CollapsibleRoot className="relative">
			<CollapsibleTrigger className="group relative block w-full text-left" aria-label="Toggle code block collapsible">
				<ChevronRight className="absolute top-1 -left-3 h-3.5 w-3.5 text-slate-500 transition-transform group-data-[state=open]:rotate-90 dark:text-slate-300" />
				{firstLine}
			</CollapsibleTrigger>
			{restLines.length > 0 ? <CollapsibleContent>{restLines}</CollapsibleContent> : null}
		</CollapsibleRoot>
	);
};

export const Collapsible = ({
	children,
	"data-code-block-wrapper": dataCodeBlockWrapper,
	className,
}: {
	children: ReactNode;
	"data-code-block-wrapper"?: string | boolean;
	className?: string;
}) => {
	const isCodeBlockWrapper = dataCodeBlockWrapper === true || dataCodeBlockWrapper === "true";
	if (isCodeBlockWrapper) {
		return <CodeBlockCollapsiblePreview>{children}</CodeBlockCollapsiblePreview>;
	}

	return (
		<CollapsibleRoot
			className={cn("rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900", className)}
		>
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-700 text-sm hover:bg-slate-100 data-[state=open]:bg-slate-100 dark:text-slate-200 dark:data-[state=open]:bg-slate-800 dark:hover:bg-slate-800">
				<ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-90 dark:text-slate-400" />

				<span className="group-data-[state=open]:hidden">펼치기</span>
				<span className="hidden group-data-[state=open]:inline">접기</span>
			</CollapsibleTrigger>

			<CollapsibleContent className="px-3 pt-2 pb-3 text-slate-700 dark:text-slate-200">{children}</CollapsibleContent>
		</CollapsibleRoot>
	);
};
