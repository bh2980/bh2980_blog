// components/callout.tsx
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, Info, Lightbulb, XCircle } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Alert, AlertTitle, type alertVariants } from "./ui/alert";

type CalloutVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const ICON_BY_VARIANT: Record<CalloutVariant, React.ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: XCircle,
};

const TITLE_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "NOTE",
	tip: "TIP",
	info: "INFO",
	warning: "WARNING",
	danger: "DANGER",
};

export const Callout = ({
	variant = "note",
	title,
	description,
	children,
}: VariantProps<typeof alertVariants> &
	PropsWithChildren<{
		title?: string;
		description?: string;
	}>) => {
	const v = (variant as CalloutVariant) ?? "note";
	const Icon = ICON_BY_VARIANT[v] ?? AlertCircle;
	const resolvedTitle = title ?? TITLE_BY_VARIANT[v];

	return (
		<Alert variant={v}>
			<Icon />
			<AlertTitle>{resolvedTitle}</AlertTitle>
			<div className="col-start-2">{children || description}</div>
		</Alert>
	);
};
