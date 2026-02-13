import type { ComponentPropsWithRef } from "react";
import { cn } from "@/utils/cn";

export const a = ({ children, href, ...props }: ComponentPropsWithRef<"a">) => {
	const h = typeof href === "string" ? href : "";
	const isHash = h.startsWith("#");
	const isExternal = /^https?:\/\//.test(h);

	if (isHash || !isExternal) {
		return (
			<a href={href} {...props} className={props.className}>
				{children}
			</a>
		);
	}

	return (
		<a
			href={href}
			{...props}
			className={cn(
				"text-current decoration-slate-300/50 underline-offset-4",
				"hover:text-slate-900 hover:decoration-slate-900",
				"dark:decoration-slate-500/50 dark:hover:text-slate-300 dark:hover:decoration-slate-300",
				"after:inline-block after:opacity-30 after:content-['↗'] hover:after:opacity-100",
				props.className,
			)}
			target={props.target ?? "_blank"}
			rel={props.rel ?? "noreferrer noopener"}
		>
			{children}
		</a>
	);
};
