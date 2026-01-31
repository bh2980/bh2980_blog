"use client";

import type { Root } from "hast";
import { useEffect, useState } from "react";
import { type AnnotationConfig, extractAnnotationsFromAst } from "@/keystatic/libs/serialize-annotations";
import { highlight } from "@/libs/shiki/code-highligher";
import { cn } from "@/utils/cn";
import { isDefined } from "@/utils/is-defined";
import { useLiveCodeBlockNode } from "../../hooks/use-live-code-block-node";
import type { CodeBlockNodeViewProps } from "./component";
import { CodeBlockToolbar, HastView } from "./components";

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const codeBlockNode = useLiveCodeBlockNode(props.value.id);
	const [hast, setHast] = useState<Root>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: id가 없을 경우에 최초 부여용
	useEffect(() => {
		if (props.value.id) {
			return;
		}

		const id = crypto.randomUUID();

		props.onChange({ ...props.value, id });
	}, [props.value.id]);

	useEffect(() => {
		if (!codeBlockNode) {
			return;
		}

		const result = extractAnnotationsFromAst(codeBlockNode, keystaticAnnotationConfig);

		if (!isDefined(result?.code)) {
			return;
		}

		const highlighedHast = highlight(result.code, props.value.lang, {});

		setHast(highlighedHast);
	}, [codeBlockNode, props.value.lang]);

	return (
		<div className={cn("flex flex-col gap-2 rounded-lg", props.isSelected && "outline-2 outline-offset-8")}>
			<CodeBlockToolbar {...props} />
			<div className="relative rounded-lg *:m-0!" style={{ backgroundColor: "rgb(40, 44, 52)" }}>
				<pre
					className={cn(
						"relative z-20 w-full outline-none",
						"bg-transparent! text-transparent! caret-white!",
						props.value.meta.showLineNumbers && "[&_p]:pl-7!",
					)}
				>
					{props.children}
				</pre>
				{hast && <HastView hast={hast} showLineNumbers={props.value.meta.showLineNumbers} />}
			</div>
		</div>
	);
};

export const keystaticAnnotationConfig: AnnotationConfig = {
	decoration: [
		{
			name: "Tooltip",
			source: "mdx-text",
			class: "underline underline-dotted",
		},
		{
			name: "strong",
			source: "mdast",
			class: "font-bold",
		},
		{
			name: "emphasis",
			source: "mdast",
			class: "italic",
		},
		{
			name: "delete",
			source: "mdast",
			class: "line-through",
		},
		{
			name: "u",
			source: "mdx-text",
			class: "underline",
		},
	],
};
