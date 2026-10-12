import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/utils";

export const alertVariants = cva(
	[
		"relative w-full border-l-2 py-1 pr-0 pl-4 text-sm",
		"[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
		"[&_:is(ul,ol)>li]:marker:text-muted-foreground",
	].join(" "),
	{
		variants: {
			layout: {
				grid: "grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-1 items-start",
				stack: "block",
			},
			variant: {
				note: "border-l-primary text-foreground [&>svg]:text-primary",
				tip: "[--tone:oklch(0.6_0.12_155)] border-l-(--tone) text-foreground [&>svg]:text-(--tone)",
				info: "[--tone:oklch(0.6_0.1_235)] border-l-(--tone) text-foreground [&>svg]:text-(--tone)",
				warning: "[--tone:oklch(0.7_0.13_75)] border-l-(--tone) text-foreground [&>svg]:text-(--tone)",
				danger: "[--tone:oklch(0.58_0.17_25)] border-l-(--tone) text-foreground [&>svg]:text-(--tone)",
			},
		},
		defaultVariants: {
			layout: "grid",
			variant: "note",
		},
	},
);

function Alert({
	className,
	layout,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div data-slot="alert" role="alert" className={cn(alertVariants({ layout, variant }), className)} {...props} />
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"col-start-2 grid justify-items-start gap-1 text-muted-foreground text-sm [&_p]:leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
