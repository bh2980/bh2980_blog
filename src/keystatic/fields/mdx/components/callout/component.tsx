// editor-callout.tsx
import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { AlertCircle } from "lucide-react";

import { CalloutNodeView } from "./node-view";

const CALLOUT_TYPES = [
	{ label: "NOTE", value: "note" },
	{ label: "TIP", value: "tip" },
	{ label: "INFO", value: "info" },
	{ label: "WARNING", value: "warning" },
	{ label: "DANGER", value: "danger" },
] as const;

export const callout = wrapper({
	label: "Callout",
	icon: <AlertCircle />,
	schema: {
		variant: fields.select({
			label: "종류",
			options: CALLOUT_TYPES.map((t) => ({ label: t.label, value: t.value })),
			defaultValue: "note",
		}),
		// 백업용(렌더/편집 우선순위는 children)
		description: fields.text({ label: "Description (backup)" }),
	},

	NodeView: CalloutNodeView,
});
