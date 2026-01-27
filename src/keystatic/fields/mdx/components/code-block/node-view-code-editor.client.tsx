"use client";

import { type HighlightedCode, highlight, Pre } from "codehike/code";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
	const preRef = useRef<HTMLPreElement>(null);

	const [code, setCode] = useState("");
	const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

	const handlers = useMemo(() => (value.useLineNumber ? [lineNumbers] : []), [value.useLineNumber]);

	useLayoutEffect(() => {
		const el = preRef.current;
		if (!el) return;

		const update = () => setCode(el.innerText ?? "");

		update();

		const obs = new MutationObserver(update);
		obs.observe(el, { subtree: true, childList: true, characterData: true });

		return () => obs.disconnect();
	}, []);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const h = await highlight({ value: escapeCodeHikeAnnotations(code), lang: value.lang, meta: "" }, "dark-plus");
			if (!cancelled) setHighlighted(h);
		})();

		return () => {
			cancelled = true;
		};
	}, [code, value.lang]);

	return (
		<div className="relative">
			{renderToolbar?.({ value: { ...value, code }, ...props })}
			<pre
				className={cn(
					"absolute w-full [&_p]:m-0!",
					"bg-transparent! text-transparent! caret-white!",
					value.useLineNumber && "ml-[calc(2ch+0.5rem)]",
					"**:data-[component=u]:decoration-white! [&_s]:decoration-1! [&_s]:decoration-white!",
				)}
				style={highlighted?.style}
				ref={preRef}
			>
				{nodeViewChildren}
			</pre>
			{highlighted && (
				<Pre
					code={highlighted}
					style={{ ...highlighted.style }}
					className="pointer-events-none w-full select-none"
					handlers={handlers}
				/>
			)}
		</div>
	);
};
