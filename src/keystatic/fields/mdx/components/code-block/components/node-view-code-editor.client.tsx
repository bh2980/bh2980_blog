"use client";

import type { Root } from "hast";
import { type ReactNode, useEffect, useState } from "react";
import type { DecorationItem } from "shiki";
import {
	type AnnotationConfig,
	buildAnnotationHelper,
	extractAnnotationsFromAst,
} from "@/keystatic/libs/serialize-annotations";
import { highlight } from "@/libs/shiki/code-highligher";
import { cn } from "@/utils/cn";
import { isDefined } from "@/utils/is-defined";
import { useLiveCodeBlockNode } from "../../../hooks/use-live-code-block-node";
import { HastView } from "./hast-view";

export const keystaticAnnotationConfig: AnnotationConfig = {
	decoration: [
		{
			name: "Tooltip",
			source: "mdx-text",
			class: "underline decoration-dotted underline-offset-4",
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
			class: "underline underline-offset-4",
		},
	],
};

const { annoRegistry } = buildAnnotationHelper(keystaticAnnotationConfig);

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

		// TODO : 추후 highlight 쪽으로 로직 통합 리팩토링(현재 line annotation에 대한 변환만 있음)
		const decorations: DecorationItem[] = result.annotations
			.map((anno) => ({ ...anno, ...annoRegistry.get(anno.name) }))
			.filter((anno) => "class" in anno)
			.map((anno) => {
				return { start: anno.range.start, end: anno.range.end, properties: { class: anno.class } };
			});

		const highlighedHast = highlight(result.code, lang, {}, decorations);

		setHast(highlighedHast);
	}, [codeBlockNode, lang]);

	return (
		<div className="relative rounded-lg *:m-0!">
			{hast && <HastView hast={hast} showLineNumbers={showLineNumbers} />}
			<pre
				className={cn(
					"relative w-full outline-none [&_p]:my-0!",
					"bg-transparent! text-transparent! caret-black!",
					showLineNumbers && "[&_p]:pl-7!",
				)}
			>
				{nodeViewChildren}
			</pre>
		</div>
	);
};
