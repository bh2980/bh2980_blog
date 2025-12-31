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
	edtior = false,
}: VariantProps<typeof alertVariants> &
	PropsWithChildren<{
		title?: string;
		description?: string;
		edtior?: boolean;
	}>) => {
	const v = variant ?? "note";
	const Icon = ICON_BY_VARIANT[v];
	const resolvedTitle = title ?? TITLE_BY_VARIANT[v];

	return (
		<Alert variant={v}>
			<Icon />
			<AlertTitle>{resolvedTitle}</AlertTitle>
			{edtior ? (
				<div className="col-start-2 w-full">{children || description}</div>
			) : (
				<AlertDescription className="mt-1 [&_p]:m-0">{children || description}</AlertDescription>
			)}
		</Alert>
	);
};
