"use client";

import { ChevronRight, PanelTopOpen, Trash2 } from "lucide-react";
import { useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import { WRAPPER_TOOLBAR_NODE_ID_ATTR, useWrapperToolbarPortalSnapshot } from "@/keystatic/plugins/pm/wrapper-toolbar-portal-store";
import { cn } from "@/utils/cn";
import type { CollapsibleNodeViewProps } from "./component";

export const CollapsibleNodeView = ({ onRemove, children, isSelected, value, onChange }: CollapsibleNodeViewProps) => {
	const wrapperNodeId = useId();
	const toolbarState = useWrapperToolbarPortalSnapshot();

	return (
		<div
			data-wrapper-toolbar-node="Collapsible"
			{...{ [WRAPPER_TOOLBAR_NODE_ID_ATTR]: wrapperNodeId }}
			className={cn("relative flex flex-col rounded-sm border", isSelected && "outline-2 outline-offset-8")}
		>
			<span className="absolute top-2.5 -left-3">
				<ChevronRight className="size-3 stroke-black" />
			</span>
			{children}
			{toolbarState.host && toolbarState.activeWrapperId === wrapperNodeId
				? createPortal(
						<div className="flex rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
							<ButtonGroup>
								<Toggle
									size={"sm"}
									variant={"outline"}
									pressed={value.defaultOpen}
									onPressedChange={(pressed) => onChange({ ...value, defaultOpen: pressed })}
								>
									<PanelTopOpen />
								</Toggle>
								<Button variant={"destructive"} onClick={onRemove} size="icon-sm">
									<Trash2 />
								</Button>
							</ButtonGroup>
						</div>,
						toolbarState.host,
					)
				: null}
		</div>
	);
};
