// components/callout.tsx
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Alert, AlertDescription, AlertTitle, type alertVariants } from "./ui/alert";

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

export const Callout = ({
	variant = "note",
	title,
	description,
	children,
	preview = false,
}: VariantProps<typeof alertVariants> &
	PropsWithChildren<{
		title?: string;
		description?: string;
		preview?: boolean;
	}>) => {
	const v = (variant as CalloutVariant) ?? "note";
	const Icon = ICON_BY_VARIANT[v] ?? AlertCircle;
	const resolvedTitle = title ?? TITLE_BY_VARIANT[v];

	return (
		<Alert variant={v}>
			<Icon />
			<AlertTitle>{resolvedTitle}</AlertTitle>
			{preview ? (
				<div className="col-start-2">{children || description}</div>
			) : (
				<AlertDescription className="mt-1 [&_p]:m-0">{children || description}</AlertDescription>
			)}
		</Alert>
	);
};
