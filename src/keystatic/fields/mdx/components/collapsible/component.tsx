// editor-callout.tsx
import { wrapper } from "@keystatic/core/content-components";
import { ListCollapseIcon } from "lucide-react";

import { CollapsibleNodeView } from "./node-view";

export const collapsible = wrapper({
	label: "Collapsible",
	icon: <ListCollapseIcon />,
	schema: {},

	NodeView: CollapsibleNodeView,
});
