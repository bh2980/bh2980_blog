import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type CollapsibleNodeViewProps = {
	value: {
		readonly label: string;
	};
	onChange(value: { readonly label: string }): void;
	onRemove(): void;
	isSelected: boolean;
	children: ReactNode;
};

function stopBubble(e: any) {
	e.stopPropagation?.();
}

export const CollapsibleNodeView = ({ onRemove, isSelected, children }: CollapsibleNodeViewProps) => {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
				isSelected && "outline-2 outline-slate-500 outline-offset-2",
			)}
			data-ks-stop-event
		>
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-2">
				<div className="font-bold text-slate-500 text-xs uppercase">Collapsible</div>

				<Button
					type="button"
					variant="destructive"
					size="icon"
					onClick={onRemove}
					onMouseDown={stopBubble}
					data-ks-stop-event
					aria-label="Remove mdx block"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>

			<div className="rounded-md border border-slate-200 bg-white/60 p-2">{children}</div>
		</div>
	);
};
