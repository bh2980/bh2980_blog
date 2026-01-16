import { ArrowUpRight } from "lucide-react";
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
				"group inline-flex items-center",
				"text-current decoration-slate-300/50 underline-offset-4",
				"hover:text-slate-900 hover:decoration-slate-900",
				"dark:decoration-slate-500/50 dark:hover:text-slate-300 dark:hover:decoration-slate-300",
				props.className,
			)}
			target={props.target ?? "_blank"}
			rel={props.rel ?? "noreferrer noopener"}
		>
			{children}
			<ArrowUpRight className="mr-1 size-4 text-slate-400/60 group-hover:text-slate-900 dark:group-hover:text-slate-300" />
		</a>
	);
};
