"use client";

import type { FormFieldInputProps } from "@keystatic/core";
import { type HighlightedCode, highlight, Pre, type RawCode } from "codehike/code";
import { useCallback, useEffect, useState } from "react";
import { collapse, collapseContent, collapseTrigger, diff, fold, lineNumbers, mark } from "@/components/code-handler";

export function CodePreview({ codeblock }: { codeblock: RawCode }) {
	const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

	const setCode = useCallback(async (cb: RawCode) => {
		const h = await highlight(cb, "dark-plus");
		setHighlighted(h);
	}, []);

	useEffect(() => {
		if (!codeblock?.value) return;
		setCode(codeblock);
	}, [codeblock, setCode]);

	if (!highlighted)
		return (
			<div className="relative overflow-hidden rounded-lg bg-zinc-950">
				{codeblock.meta && <div className="py-2 text-center font-bold text-sm text-zinc-400">{codeblock.meta}</div>}
			</div>
		);

	return (
		<div className="relative overflow-hidden rounded-lg bg-zinc-950">
			{codeblock.meta && <div className="py-2 text-center font-bold text-sm text-zinc-400">{codeblock.meta}</div>}
			<Pre
				className="overflow-auto"
				code={highlighted}
				style={highlighted.style}
				handlers={[mark, lineNumbers, fold, diff, collapse, collapseContent, collapseTrigger]}
			/>
		</div>
	);
}

export function CodeInput(props: FormFieldInputProps<RawCode>) {
	return (
		<div className="flex flex-col gap-2">
			<select
				value={props.value?.lang ?? ""}
				onChange={(e) => props.onChange({ value: props.value?.value, meta: props.value?.meta, lang: e.target.value })}
			>
				<option value="ts">TypeScript</option>
				<option value="js">JavaScript</option>
				<option value="python">Python</option>
			</select>
			<textarea
				className="min-h-[240px] rounded-md border p-2 font-mono text-sm"
				value={props.value?.value ?? ""}
				onChange={(e) => props.onChange({ lang: props.value?.lang, meta: props.value?.meta, value: e.target.value })}
			/>

			<CodePreview codeblock={props.value} />
		</div>
	);
}
