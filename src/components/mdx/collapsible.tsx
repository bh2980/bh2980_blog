import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { CollapsibleContent, Collapsible as CollapsibleRoot, CollapsibleTrigger } from "../ui/collapsible";

export const Collapsible = ({ children }: { children: ReactNode }) => {
	return (
		<CollapsibleRoot className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-700 text-sm hover:bg-slate-100 data-[state=open]:bg-slate-100 dark:text-slate-200 dark:data-[state=open]:bg-slate-800 dark:hover:bg-slate-800">
				<ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-90 dark:text-slate-400" />

				<span className="group-data-[state=open]:hidden">펼치기</span>
				<span className="hidden group-data-[state=open]:inline">접기</span>
			</CollapsibleTrigger>

			<CollapsibleContent className="px-3 pt-2 pb-3 text-slate-700 dark:text-slate-200">{children}</CollapsibleContent>
		</CollapsibleRoot>
	);
};
