import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { CollapsibleContent, Collapsible as CollapsibleRoot, CollapsibleTrigger } from "../ui/collapsible";

export const Collapsible = ({
	children,
	className,
	defaultOpen,
	title,
	fallbackTitle = "펼치기",
}: {
	children: ReactNode;
	className?: string;
	defaultOpen?: boolean;
	title?: string;
	/** 제목이 없을 때 쓰는 문구. 공개 화면의 언어에 맞춰 넘긴다(v2 B4). */
	fallbackTitle?: string;
}) => {
	const triggerLabel = title?.trim() || fallbackTitle;

	return (
		<CollapsibleRoot
			className={cn("rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900", className)}
			defaultOpen={defaultOpen}
		>
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-700 text-sm hover:bg-slate-100 data-panel-open:bg-slate-100 dark:text-slate-200 dark:data-panel-open:bg-slate-800 dark:hover:bg-slate-800">
				<ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-panel-open:rotate-90 dark:text-slate-400" />
				<span>{triggerLabel}</span>
			</CollapsibleTrigger>

			<CollapsibleContent className="px-3 pt-2 pb-3 text-slate-700 dark:text-slate-200">{children}</CollapsibleContent>
		</CollapsibleRoot>
	);
};
