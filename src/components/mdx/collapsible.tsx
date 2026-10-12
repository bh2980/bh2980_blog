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
		<CollapsibleRoot className={cn("my-6 border-y", className)} defaultOpen={defaultOpen}>
			<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-sm py-2.5 text-foreground text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
				<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90" />
				<span>{triggerLabel}</span>
			</CollapsibleTrigger>

			{/* 안쪽 첫·끝 블록의 여백이 상자 안쪽 여백에 더해지지 않게 0으로 둔다. */}
			<CollapsibleContent className="pt-1 pb-4 pl-6 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0">
				{children}
			</CollapsibleContent>
		</CollapsibleRoot>
	);
};
