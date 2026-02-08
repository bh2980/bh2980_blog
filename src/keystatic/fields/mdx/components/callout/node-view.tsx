"use client";

import { Trash2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import { createPortal } from "react-dom";
import { Callout } from "@/components/mdx/callout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WRAPPER_TOOLBAR_NODE_ID_ATTR, useWrapperToolbarPortalSnapshot } from "@/keystatic/plugins/pm/wrapper-toolbar-portal-store";
import { cn } from "@/utils/cn";

const CALLOUT_TYPES = [
	{ label: "NOTE", value: "note" },
	{ label: "TIP", value: "tip" },
	{ label: "INFO", value: "info" },
	{ label: "WARNING", value: "warning" },
	{ label: "DANGER", value: "danger" },
] as const;

type CalloutType = (typeof CALLOUT_TYPES)[number]["value"];

type CalloutNodeViewProps = {
	value: {
		readonly variant: "note" | "tip" | "info" | "warning" | "danger";
		readonly description: string;
	};
	onChange(value: {
		readonly variant: "note" | "tip" | "info" | "warning" | "danger";
		readonly description: string;
	}): void;
	onRemove(): void;
	isSelected: boolean;
	children: ReactNode;
};

export const CalloutNodeView = ({ value, onChange, onRemove, isSelected, children }: CalloutNodeViewProps) => {
	const calloutType = (value.variant ?? "note") as CalloutType;
	const wrapperNodeId = useId();
	const toolbarState = useWrapperToolbarPortalSnapshot();

	const stop = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		e.nativeEvent?.stopImmediatePropagation?.();
	};

	return (
		<div
			data-wrapper-toolbar-node="Callout"
			{...{ [WRAPPER_TOOLBAR_NODE_ID_ATTR]: wrapperNodeId }}
			className={cn(
				"relative flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
				isSelected && "outline-2 outline-slate-500 outline-offset-2",
			)}
		>
			<Callout variant={calloutType} title={calloutType.toUpperCase()} description={value.description ?? ""} editor>
				<div className="rounded-md border border-slate-200 bg-white/60 p-2">{children}</div>
			</Callout>
			{toolbarState.host && toolbarState.activeWrapperId === wrapperNodeId
				? createPortal(
						<div className="flex min-w-[320px] items-center justify-between gap-3 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
							<Select value={calloutType} onValueChange={(nextValue) => onChange({ ...value, variant: nextValue as CalloutType })}>
								<SelectTrigger className="h-9 w-[180px] bg-white" onMouseDown={stop}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent onMouseDown={stop}>
									{CALLOUT_TYPES.map((typeOption) => (
										<SelectItem key={typeOption.value} value={typeOption.value}>
											{typeOption.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant="destructive"
								size="icon"
								onClick={onRemove}
								onMouseDown={stop}
								aria-label="Remove callout"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>,
						toolbarState.host,
					)
				: null}
		</div>
	);
};
