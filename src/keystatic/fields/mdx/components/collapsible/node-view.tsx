import { ChevronRight, Trash2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
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
	const stop = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		e.nativeEvent?.stopImmediatePropagation?.();
	};

	return (
		<div
			data-wrapper-toolbar-node="Collapsible"
			className={cn("relative flex flex-col rounded-sm pb-10", "outline-1 outline-border outline-t- outline-offset-2")}
		>
			<span className="absolute top-1 -left-3">
				<ChevronRight className="size-3 stroke-black" />
			</span>
			{children}
			<div data-wrapper-toolbar-ui className="pointer-events-auto absolute right-2 bottom-2">
				<Button
					onClick={onRemove}
					onMouseDown={stop}
					variant={"destructive"}
					size="icon-sm"
					className="size-6"
					aria-label="Remove collapsible"
				>
					<Trash2 className="size-3" />
				</Button>
			</div>
		</div>
	);
};
