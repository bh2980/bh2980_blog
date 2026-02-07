"use client";

import type { Root } from "hast";
import { type ReactNode, useEffect, useState } from "react";
import { fromMdastToCodeBlockDocument } from "@/libs/annotation/code-block/mdast-to-document";
import type { AnnotationConfig, CodeBlockRoot } from "@/libs/annotation/code-block/types";
import { highlight } from "@/libs/shiki/code-highligher";
import { fromCodeBlockDocumentToShikiAnnotationPayload } from "@/libs/shiki/remark-annotation-to-decoration";
import { cn } from "@/utils/cn";
import { useLiveCodeBlockNode } from "../../../hooks/use-live-code-block-node";
import { EDITOR_CODE_BLOCK_ANNOTATION_CONFIG } from "../constants";
import { HastView } from "./hast-view";

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	initProseMirrorId,
	proseMirrorId,
	showLineNumbers,
	annotationConfig = EDITOR_CODE_BLOCK_ANNOTATION_CONFIG,
}: {
	nodeViewChildren: ReactNode;
	lang: string;
	initProseMirrorId: (id: string) => void;
	proseMirrorId?: string;
	showLineNumbers?: boolean;
	annotationConfig?: AnnotationConfig;
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

		const document = fromMdastToCodeBlockDocument(codeBlockNode as CodeBlockRoot, annotationConfig);
		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document);
		const highlighedHast = highlight(payload.code, payload.lang || lang, payload.meta, {
			decorations: payload.decorations,
			lineDecorations: payload.lineDecorations,
			lineWrappers: [],
		});

		setHast(highlighedHast);
	}, [codeBlockNode, lang, annotationConfig]);

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
