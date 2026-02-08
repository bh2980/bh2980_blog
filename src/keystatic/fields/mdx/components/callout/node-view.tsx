"use client";

import { Trash2 } from "lucide-react";
import { type MouseEvent, useId } from "react";
import { createPortal } from "react-dom";
import { Callout } from "@/components/mdx/callout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	useWrapperToolbarPortalSnapshot,
	WRAPPER_TOOLBAR_NODE_ID_ATTR,
} from "@/keystatic/plugins/pm/wrapper-toolbar-portal-store";
import { cn } from "@/utils/cn";
import type { CalloutNodeViewProps, CalloutVariant } from "./component";

const CALLOUT_TYPES = [
	{ label: "NOTE", value: "note" },
	{ label: "TIP", value: "tip" },
	{ label: "INFO", value: "info" },
	{ label: "WARNING", value: "warning" },
	{ label: "DANGER", value: "danger" },
] as const;

export const CalloutNodeView = ({ value, onChange, onRemove, isSelected, children }: CalloutNodeViewProps) => {
	const calloutType = (value.variant ?? "note") as CalloutVariant;
	const wrapperNodeId = useId();
	const toolbarState = useWrapperToolbarPortalSnapshot();
	const stopEditorEvent = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<div
			data-wrapper-toolbar-node="Callout"
			{...{ [WRAPPER_TOOLBAR_NODE_ID_ATTR]: wrapperNodeId }}
			className={cn(
				"relative flex flex-col gap-3 rounded-lg",
				isSelected && "outline-2 outline-slate-500 outline-offset-2",
			)}
		>
			<Callout variant={calloutType} title={calloutType.toUpperCase()} description={value.description ?? ""} editor>
				<div className="rounded-md border border-slate-200 bg-white/60 p-2">{children}</div>
			</Callout>
			{toolbarState.host && toolbarState.activeWrapperId === wrapperNodeId
				? createPortal(
						<div className="flex items-center justify-between gap-3 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
							<Select
								value={calloutType}
								onValueChange={(nextValue) => onChange({ ...value, variant: nextValue as CalloutVariant })}
							>
								<SelectTrigger className="h-9 w-[180px] bg-white" onMouseDown={stopEditorEvent}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="z-80">
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
								onMouseDown={stopEditorEvent}
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
