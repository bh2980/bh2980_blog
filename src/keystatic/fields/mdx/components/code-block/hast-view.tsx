import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@/utils/cn";

export function HastView({ hast, showLineNumbers }: { hast: Root; showLineNumbers?: boolean }) {
	return toJsxRuntime(hast, {
		Fragment,
		jsx,
		jsxs,
		passKeys: true,
		components: {
			pre: (props: ComponentProps<"pre">) => (
				<pre
					{...props}
					className={cn(props.className, "pointer-events-none absolute top-0 left-0 z-10 w-full")}
					data-show-line-numbers={showLineNumbers ? "true" : undefined}
				/>
			),
		},
	});
}
