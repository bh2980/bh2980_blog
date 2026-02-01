"use client";

import type { Root } from "hast";
import { type ReactNode, useEffect, useState } from "react";
import { type AnnotationConfig, extractAnnotationsFromAst } from "@/keystatic/libs/serialize-annotations";
import { highlight } from "@/libs/shiki/code-highligher";
import { cn } from "@/utils/cn";
import { isDefined } from "@/utils/is-defined";
import { useLiveCodeBlockNode } from "../../../hooks/use-live-code-block-node";
import { HastView } from "./hast-view";

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	initProseMirrorId,
	proseMirrorId,
	showLineNumbers,
}: {
	nodeViewChildren: ReactNode;
	lang: string;
	initProseMirrorId: (id: string) => void;
	proseMirrorId?: string;
	showLineNumbers?: boolean;
}) => {
	const codeBlockNode = useLiveCodeBlockNode(proseMirrorId);
	const [hast, setHast] = useState<Root>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: id가 없을 경우에 최초 부여용
	useEffect(() => {
		if (proseMirrorId) {
			return;
		}

		const blockId = crypto.randomUUID();

		initProseMirrorId(blockId);
	}, []);

	useEffect(() => {
		if (!codeBlockNode) {
			return;
		}

		const result = extractAnnotationsFromAst(codeBlockNode, keystaticAnnotationConfig);

		if (!isDefined(result?.code)) {
			return;
		}

		const highlighedHast = highlight(result.code, lang, {});

		setHast(highlighedHast);
	}, [codeBlockNode, lang]);

	return (
		<div className="relative rounded-lg *:m-0!" style={{ backgroundColor: "rgb(40, 44, 52)" }}>
			{hast && <HastView hast={hast} showLineNumbers={showLineNumbers} />}
			<pre
				className={cn(
					"relative w-full outline-none",
					"bg-transparent! text-transparent! caret-black!",
					showLineNumbers && "[&_p]:pl-7!",
				)}
			>
				{nodeViewChildren}
			</pre>
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
