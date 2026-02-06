import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@/utils/cn";

const TooltipPreview = ({ className, children, ...props }: ComponentProps<"span">) => (
	<span {...props} className={cn("underline decoration-dotted underline-offset-4", className)}>
		{children}
	</span>
);

const WrapperPreviewFrame = ({
	className,
	label,
	prefix,
	children,
	...props
}: ComponentProps<"div"> & { label: string; prefix?: string }) => (
	<div {...props} className={cn("relative my-1 rounded-md border border-slate-300 bg-slate-50/70 px-2 py-1", className)}>
		<span className="pointer-events-none absolute -top-2 left-2 rounded border border-slate-300 bg-white px-1 font-medium text-[10px] leading-4 text-slate-500">
			{prefix}
			{label}
		</span>
		{children}
	</div>
);

const CalloutPreview = ({ variant, ...props }: ComponentProps<"div"> & { variant?: unknown }) => (
	<WrapperPreviewFrame {...props} label={variant ? `Callout:${String(variant).toUpperCase()}` : "Callout"} />
);

const CollapsiblePreview = (props: ComponentProps<"div">) => (
	<WrapperPreviewFrame {...props} label="Collapsible" prefix="▸ " />
);

// TODO : white space pre and sync scroll
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
					className={cn(props.className, "pointer-events-none absolute top-0 left-0 min-h-full w-full border")}
					data-show-line-numbers={showLineNumbers ? "true" : undefined}
				/>
			),
			Tooltip: TooltipPreview,
			Callout: CalloutPreview,
			Collapsible: CollapsiblePreview,
		},
	});
}
