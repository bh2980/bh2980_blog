import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps, Ref } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@/utils/cn";

const CollapsibleEditorPreview = ({ children }: ComponentProps<"span">) => <>{children}</>;

const CalloutEditorPreview = ({ children }: ComponentProps<"span"> & { variant?: unknown }) => <>{children}</>;

// TODO : white space pre and sync scroll
export function HastView({
	hast,
	showLineNumbers,
	preRef,
}: {
	hast: Root;
	showLineNumbers?: boolean;
	preRef?: Ref<HTMLPreElement>;
}) {
	return toJsxRuntime(hast, {
		Fragment,
		jsx,
		jsxs,
		passKeys: true,
		components: {
			pre: (props: ComponentProps<"pre">) => {
				const { showLineNumbers: metaShowLineNumbers, ...domProps } = props as ComponentProps<"pre"> & {
					showLineNumbers?: boolean;
				};
				const resolvedShowLineNumbers = showLineNumbers ?? metaShowLineNumbers;

				return (
					<pre
						ref={preRef}
						{...domProps}
						className={cn(
							props.className,
							"whitespace-pre! overflow-x-auto overflow-y-hidden",
							"pointer-events-none absolute top-0 left-0 min-h-full w-full",
						)}
						data-show-line-numbers={resolvedShowLineNumbers ? "true" : undefined}
					/>
				);
			},
			Callout: CalloutEditorPreview,
			Collapsible: CollapsibleEditorPreview,
		},
	});
}
