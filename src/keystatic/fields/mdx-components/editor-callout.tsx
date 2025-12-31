// editor-callout.tsx
import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { AlertCircle, Trash2 } from "lucide-react";

import { Callout } from "@/components/callout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/utils/cn";

const CALLOUT_TYPES = [
	{ label: "NOTE", value: "note" },
	{ label: "TIP", value: "tip" },
	{ label: "INFO", value: "info" },
	{ label: "WARNING", value: "warning" },
	{ label: "DANGER", value: "danger" },
] as const;

type CalloutType = (typeof CALLOUT_TYPES)[number]["value"];

export const editorCallout = wrapper({
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

	NodeView: ({ value, onChange, onRemove, isSelected, children }) => {
		const calloutType = (value.variant ?? "note") as CalloutType;

		const stop = (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.nativeEvent?.stopImmediatePropagation?.();
		};

		return (
			<div
				className={cn(
					"flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
					isSelected && "outline-2 outline-slate-500 outline-offset-2",
				)}
			>
				<div className="flex items-center justify-between gap-3" data-ks-stop-event>
					<Select value={calloutType} onValueChange={(v) => onChange({ ...value, variant: v as CalloutType })}>
						<SelectTrigger className="h-9 w-[180px] bg-white" onMouseDown={stop} data-ks-stop-event>
							<SelectValue />
						</SelectTrigger>
						<SelectContent onMouseDown={stop} data-ks-stop-event>
							{CALLOUT_TYPES.map((t) => (
								<SelectItem key={t.value} value={t.value}>
									{t.label}
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
						data-ks-stop-event
						aria-label="Remove callout"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				<Callout variant={calloutType} title={calloutType.toUpperCase()} description={value.description ?? ""}>
					<div className="rounded-md border border-slate-200 bg-white/60 p-2">{children}</div>
				</Callout>
			</div>
		);
	},
});
