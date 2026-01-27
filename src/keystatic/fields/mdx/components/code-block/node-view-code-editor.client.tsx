"use client";

import { type HighlightedCode, highlight, Pre } from "codehike/code";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { lineNumbers } from "@/components/mdx/code-handler";
import { cn } from "@/utils/cn";
import type { CodeBlockNodeViewProps } from "./component";
import { escapeCodeHikeAnnotations } from "./libs";

export type RenderToolbarParams = Omit<CodeBlockNodeViewProps, "value" | "children"> & {
	value: CodeBlockNodeViewProps["value"] & { code: string };
};

type NodeViewCodeEditorProps = Omit<CodeBlockNodeViewProps, "children"> & {
	nodeViewChildren: ReactNode;
	renderToolbar?: (value: RenderToolbarParams) => ReactNode;
};

export const NodeViewCodeEditor = ({ nodeViewChildren, value, renderToolbar, ...props }: NodeViewCodeEditorProps) => {
	const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

	const textContent = (
		((nodeViewChildren as ReactElement).props as { node: HTMLSpanElement }).node.childNodes[0] as HTMLParagraphElement
	).innerText;

	useEffect(() => {
		const setCode = async (code: string) => {
			const h = await highlight({ value: code, lang: value.lang, meta: "" }, "dark-plus");
			setHighlighted(h);
		};

		setCode(escapeCodeHikeAnnotations(textContent));
	}, [textContent, value]);

	return (
		<div className="relative">
			{renderToolbar?.({ value: { ...value, code: textContent }, ...props })}
			<pre
				className={cn(
					"absolute w-full bg-transparent! text-transparent! caret-white! [&_p]:m-0!",
					value.useLineNumber && "ml-[calc(2ch+0.5rem)]",
					"**:data-[component=u]:decoration-white! [&_s]:decoration-1! [&_s]:decoration-white!",
				)}
				style={highlighted?.style}
			>
				{nodeViewChildren}
			</pre>
			{highlighted && (
				<Pre
					code={highlighted}
					style={{ ...highlighted.style }}
					className="pointer-events-none w-full select-none"
					handlers={value.useLineNumber ? [lineNumbers] : []}
				/>
			)}
		</div>
	);
};
