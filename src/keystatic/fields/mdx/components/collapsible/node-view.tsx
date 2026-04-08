"use client";

import { ChevronRight, PanelTopOpen, Trash2 } from "lucide-react";
import { useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
	useWrapperToolbarPortalSnapshot,
	WRAPPER_TOOLBAR_NODE_ID_ATTR,
} from "@/keystatic/plugins/pm/wrapper-toolbar-portal-store";
import { cn } from "@/utils/cn";
import { BlurChangeInput } from "../code-block/components";
import type { CollapsibleNodeViewProps } from "./component";

export const CollapsibleNodeView = ({ onRemove, children, isSelected, value, onChange }: CollapsibleNodeViewProps) => {
	const wrapperNodeId = useId();
	const toolbarState = useWrapperToolbarPortalSnapshot();
	const title = value.title?.trim() || "펼치기";
	const handleBlurTitle = (nextTitle: string) => onChange({ ...value, title: nextTitle || "펼치기" });

	return (
		<div
			data-wrapper-toolbar-node="Collapsible"
			{...{ [WRAPPER_TOOLBAR_NODE_ID_ATTR]: wrapperNodeId }}
			className={cn(isSelected && "outline-2 outline-slate-500 outline-offset-2")}
		>
			<div className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
				<div className="group flex w-full items-center gap-2 rounded-md px-3 py-2 font-medium text-slate-700 text-sm dark:text-slate-200">
					<ChevronRight
						className={cn(
							"h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
							value.defaultOpen && "rotate-90",
						)}
					/>
					<span className="truncate">{title}</span>
					<span className="ml-auto shrink-0 text-slate-400 text-xs dark:text-slate-500">
						{value.defaultOpen ? "기본 열림" : "기본 닫힘"}
					</span>
				</div>
				<div className="px-3 pt-2 pb-3 text-slate-700 dark:text-slate-200">{children}</div>
			</div>

			{toolbarState.host && toolbarState.activeWrapperId === wrapperNodeId
				? createPortal(
						<div className="flex items-center justify-between gap-3 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
							<div className="flex items-center gap-2">
								<Toggle
									size={"sm"}
									variant={"outline"}
									pressed={value.defaultOpen ?? false}
									onPressedChange={(pressed) => onChange({ ...value, defaultOpen: pressed })}
								>
									<PanelTopOpen />
								</Toggle>
								<BlurChangeInput defaultValue={value.title} placeholder="기본값: 펼치기" onBlur={handleBlurTitle} />
							</div>
							<Button
								type="button"
								variant={"destructive"}
								onClick={onRemove}
								size="icon-sm"
								aria-label="Remove collapsible"
							>
								<Trash2 />
							</Button>
						</div>,
						toolbarState.host,
					)
				: null}
		</div>
	);
};
