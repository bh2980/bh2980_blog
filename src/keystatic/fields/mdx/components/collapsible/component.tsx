// editor-callout.tsx
import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { ListCollapseIcon } from "lucide-react";

import { CollapsibleNodeView } from "./node-view";

export const collapsible = wrapper({
	label: "Collapsible",
	icon: <ListCollapseIcon />,
	schema: {
		label: fields.text({ label: "Collapsible Label" }),
	},

	NodeView: CollapsibleNodeView,
});
