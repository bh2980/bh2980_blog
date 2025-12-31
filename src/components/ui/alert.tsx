import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/utils";

export const alertVariants = cva(
	[
		"relative w-full rounded-lg border px-4 py-3 text-sm",
		"grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-1 items-start",
		"[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",

		"[&_:is(ul,ol)>li]:marker:text-slate-700",
		"dark:[&_:is(ul,ol)>li]:marker:text-slate-200/80",
	].join(" "),
	{
		variants: {
			variant: {
				note: [
					"bg-slate-100 border-border text-slate-900",
					"dark:bg-slate-800/70 dark:border-slate-500/60 dark:text-slate-50",
				].join(" "),
				tip: [
					"bg-emerald-50 text-emerald-900 border-emerald-200 [&>svg]:text-emerald-700",
					"dark:bg-emerald-400/25 dark:text-emerald-50 dark:border-emerald-300/70 dark:[&>svg]:text-emerald-100",
				].join(" "),
				info: [
					"bg-sky-50 text-sky-900 border-sky-200 [&>svg]:text-sky-700",
					"dark:bg-sky-400/25 dark:text-sky-50 dark:border-sky-300/70 dark:[&>svg]:text-sky-100",
				].join(" "),
				warning: [
					"bg-amber-50 text-amber-900 border-amber-200 [&>svg]:text-amber-700",
					"dark:bg-amber-400/25 dark:text-amber-50 dark:border-amber-300/70 dark:[&>svg]:text-amber-100",
				].join(" "),
				danger: [
					"bg-red-50 text-red-900 border-red-200 [&>svg]:text-red-700",
					"dark:bg-red-400/25 dark:text-red-50 dark:border-red-300/70 dark:[&>svg]:text-red-100",
				].join(" "),
			},
		},
		defaultVariants: {
			variant: "note",
		},
	},
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
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
