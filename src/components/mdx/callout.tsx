// components/callout.tsx
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Alert, type alertVariants } from "../ui/alert";

export type CalloutVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

export const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, React.ComponentType<{ className?: string }>> = {
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

type CalloutProps = PropsWithChildren<{
	variant?: CalloutVariant;
	title?: string;
}>;

export const Callout = ({ variant = "note", title, children }: CalloutProps) => {
	const v = variant ?? "note";
	const Icon = CALLOUT_ICON_BY_VARIANT[v];
	const resolvedTitle = title?.trim() ? title : getDefaultCalloutTitle(v);

	return (
		<Alert variant={v} layout="stack" className="not-prose w-full">
			<div className="flex items-start gap-2">
				<Icon className="mt-0.5 size-4 shrink-0 text-current" />
				<div className="min-h-4 min-w-0 font-medium tracking-tight">{resolvedTitle}</div>
			</div>
			{/* 본문 없이 제목만 둔 콜아웃은 빈 본문 칸을 그리지 않는다. */}
			{children ? (
				<div data-slot="callout-body" className="mt-2 text-current text-sm [&_p]:m-0 [&_p]:leading-relaxed">
					{children}
				</div>
			) : null}
		</Alert>
	);
};
