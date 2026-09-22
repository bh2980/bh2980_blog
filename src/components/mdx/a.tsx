import type { ComponentPropsWithRef } from "react";
import { cn } from "@/utils/cn";

export const a = ({ children, href, ...props }: ComponentPropsWithRef<"a">) => {
	const h = typeof href === "string" ? href : "";
	const isHash = h.startsWith("#");
	const isRootRelative = h.startsWith("/") && !h.startsWith("//");
	const isExternal = /^https?:\/\//.test(h);

	// M7-SEC-1 P2: `javascript:`·`data:` 같은 스킴이 앵커로 나가지 않도록
	// http(s)·사이트 상대 경로·`#`만 링크로 만든다. 그 밖의 값은 링크 없이 텍스트로 남긴다.
	if (!isHash && !isRootRelative && !isExternal) {
		return (
			<a {...props} className={props.className}>
				{children}
			</a>
		);
	}

	if (isHash || isRootRelative) {
		return (
			<a href={h} {...props} className={props.className}>
				{children}
			</a>
		);
	}

	return (
		<a
			href={h}
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
