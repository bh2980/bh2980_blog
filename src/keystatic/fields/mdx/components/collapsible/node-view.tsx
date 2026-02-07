import { ChevronRight, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type CollapsibleNodeViewProps = {
	value: object;
	onChange(value: object): void;
	onRemove(): void;
	isSelected: boolean;
	children: ReactNode;
};

export const CollapsibleNodeView = ({ onRemove, children }: CollapsibleNodeViewProps) => {
	return (
		<div className={cn("relative flex flex-col rounded-sm", "outline-1 outline-border outline-t- outline-offset-2")}>
			<span className="absolute top-1 -left-3">
				<ChevronRight className="size-3 stroke-black" />
			</span>
			<Button onClick={onRemove} variant={"destructive"} size="icon-sm" className="absolute top-0 right-0 size-5">
				<Trash2 className="size-3" />
			</Button>
			{children}
		</div>
	);
};
