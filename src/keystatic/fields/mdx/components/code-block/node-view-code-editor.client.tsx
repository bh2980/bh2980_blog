"use client";

import { type HighlightedCode, highlight, Pre } from "codehike/code";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lineNumbers } from "@/components/mdx/code-handler";
import { cn } from "@/utils/cn";
import { escapeCodeHikeAnnotations } from "./libs";

type NodeViewCodeEditorProps = { lang: string; useLineNumber?: boolean } & {
	nodeViewChildren: ReactNode;
	onCodeChange?: (code: string) => void;
};

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	useLineNumber,
	onCodeChange,
}: NodeViewCodeEditorProps) => {
	const preRef = useRef<HTMLPreElement>(null);

	const [code, setCode] = useState("");
	const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

	const handlers = useMemo(() => (useLineNumber ? [lineNumbers] : []), [useLineNumber]);

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
			const h = await highlight({ value: escapeCodeHikeAnnotations(code), lang, meta: "" }, "dark-plus");
			if (!cancelled) setHighlighted(h);
		})();

		return () => {
			cancelled = true;
		};
	}, [code, lang]);

	useEffect(() => {
		onCodeChange?.(code);
	}, [code, onCodeChange]);

	return (
		<div className="relative *:m-0!">
			<pre
				className={cn(
					"absolute w-full [&_p]:m-0!",
					"bg-transparent! text-transparent! caret-white!",
					"**:data-[component=u]:decoration-white! [&_s]:decoration-1! [&_s]:decoration-white!",
					useLineNumber && "ml-[calc(2ch+0.5rem)]",
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
