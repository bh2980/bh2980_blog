import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { ListCollapseIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { CollapsibleNodeView } from "./node-view";

type CollapsibleSchema = {
	readonly defaultOpen: boolean;
};

export type CollapsibleNodeViewProps = PropsWithChildren & {
	value: CollapsibleSchema;
	onChange(value: CollapsibleSchema): void;
	onRemove(): void;
	isSelected: boolean;
};

export const collapsible = wrapper({
	label: "Collapsible",
	icon: <ListCollapseIcon />,
	schema: {
		defaultOpen: fields.checkbox({
			label: "기본으로 열기",
			defaultValue: false,
		}),
	},

	NodeView: CollapsibleNodeView,
});
