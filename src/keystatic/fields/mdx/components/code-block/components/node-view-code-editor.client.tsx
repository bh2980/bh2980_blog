"use client";

import type { Root } from "hast";
import { type ReactNode, useEffect, useState } from "react";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import { buildCodeBlockDocumentFromMdast } from "@/libs/annotation/code-block/mdast-document-converter";
import type { CodeBlockRoot } from "@/libs/annotation/code-block/types";
import { highlight } from "@/libs/shiki/code-highligher";
import { composeShikiAnnotationPayloadFromDocument } from "@/libs/shiki/remark-annotation-to-decoration";
import { cn } from "@/utils/cn";
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

		const document = buildCodeBlockDocumentFromMdast(codeBlockNode as CodeBlockRoot, codeFenceAnnotationConfig);
		const payload = composeShikiAnnotationPayloadFromDocument(document);
		const highlighedHast = highlight(payload.code, payload.lang || lang, payload.meta, {
			decorations: payload.decorations,
			lineDecorations: payload.lineDecorations,
			lineWrappers: payload.lineWrappers,
		});

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
