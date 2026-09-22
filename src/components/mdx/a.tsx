import type { ComponentPropsWithRef } from "react";
import { cn } from "@/utils/cn";

/** 경로 형식 앵커를 해석할 때만 쓰는 고정 origin. */
const SITE_PATH_BASE = "https://anchor.invalid";

/**
 * 사이트 상대 경로만 통과시킨다.
 *
 * WHATWG URL 파서는 특수 스킴에서 `\`를 `/`로 본다. 그래서 `/\evil.example`은 `//evil.example`과
 * 같아져 다른 origin이 된다. 고정 origin으로 해석해 같은 origin일 때만 경로로 인정한다(M7-SEC-1 P2).
 */
function resolveSitePath(value: string): string | null {
	if (!value.startsWith("/")) return null;

	const resolved = new URL(value, SITE_PATH_BASE);

	return resolved.origin === SITE_PATH_BASE ? `${resolved.pathname}${resolved.search}${resolved.hash}` : null;
}

export const a = ({ children, href, ...props }: ComponentPropsWithRef<"a">) => {
	const h = typeof href === "string" ? href : "";
	const isHash = h.startsWith("#");
	const sitePath = resolveSitePath(h);
	const isExternal = /^https?:\/\//.test(h);
	/** `#` 앵커와 사이트 상대 경로는 같은 취급(일반 링크)이다. */
	const siteHref = isHash ? h : sitePath;

	// M7-SEC-1 P2: `javascript:`·`data:`·`//host`·`/\host`가 앵커로 나가지 않도록
	// http(s)·사이트 상대 경로·`#`만 링크로 만든다. 그 밖의 값은 링크 없이 텍스트로 남긴다.
	if (!siteHref && !isExternal) {
		return (
			<a {...props} className={props.className}>
				{children}
			</a>
		);
	}

	if (siteHref) {
		return (
			<a href={siteHref} {...props} className={props.className}>
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
