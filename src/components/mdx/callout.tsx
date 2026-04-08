// components/callout.tsx
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Alert, type alertVariants } from "../ui/alert";

type CalloutVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const ICON_BY_VARIANT: Record<CalloutVariant, React.ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: AlertOctagon,
};

const TITLE_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "NOTE",
	tip: "TIP",
	info: "INFO",
	warning: "WARNING",
	danger: "DANGER",
};

export const getDefaultCalloutTitle = (variant: CalloutVariant) => TITLE_BY_VARIANT[variant];

export const Callout = ({
	variant = "note",
	title,
	description,
	children,
	editor = false,
}: VariantProps<typeof alertVariants> &
	PropsWithChildren<{
		title?: string;
		description?: string;
		editor?: boolean;
	}>) => {
	const v = variant ?? "note";
	const Icon = ICON_BY_VARIANT[v];
	const resolvedTitle = title?.trim() ? title : getDefaultCalloutTitle(v);

	return (
		<Alert variant={v} className="not-prose block w-full">
			<div className="flex items-start gap-2">
				<Icon className="mt-0.5 size-4 shrink-0 text-current" />
				<div className="min-h-4 min-w-0 font-medium tracking-tight">{resolvedTitle}</div>
			</div>
			{editor ? (
				<div data-slot="callout-body" className="mt-2 w-full">
					{children || description}
				</div>
			) : (
				<div data-slot="callout-body" className="mt-2 text-current text-sm [&_p]:m-0 [&_p]:leading-relaxed">
					{children || description}
				</div>
			)}
		</Alert>
	);
};
