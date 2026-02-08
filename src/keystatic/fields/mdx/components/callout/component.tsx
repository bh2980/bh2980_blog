// editor-callout.tsx
import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { AlertCircle } from "lucide-react";
import type { PropsWithChildren } from "react";

import { CalloutNodeView } from "./node-view";

export const CALLOUT_TYPES = [
	{ label: "NOTE", value: "note" },
	{ label: "TIP", value: "tip" },
	{ label: "INFO", value: "info" },
	{ label: "WARNING", value: "warning" },
	{ label: "DANGER", value: "danger" },
] as const;

export type CalloutVariant = (typeof CALLOUT_TYPES)[number]["value"];

type CalloutSchema = {
	readonly variant: CalloutVariant;
	readonly description: string;
};

export type CalloutNodeViewProps = PropsWithChildren & {
	value: CalloutSchema;
	onChange(value: CalloutSchema): void;
	onRemove(): void;
	isSelected: boolean;
};

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
