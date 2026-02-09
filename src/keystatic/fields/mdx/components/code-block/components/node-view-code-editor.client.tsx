"use client";

import type { Root } from "hast";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { fromMdxFlowElementToCodeDocument } from "@/libs/annotation/code-block/mdast-to-document";
import type { AnnotationConfig } from "@/libs/annotation/code-block/types";
import { highlight } from "@/libs/shiki/code-highligher";
import { fromCodeBlockDocumentToShikiAnnotationPayload } from "@/libs/shiki/remark-annotation-to-decoration";
import { createAllowedRenderTagsFromConfig } from "@/libs/shiki/render-policy";
import { cn } from "@/utils/cn";
import { useLiveCodeBlockNode } from "../../../hooks/use-live-code-block-node";
import { useSyncScroll } from "../../../hooks/use-sync-scroll";
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
	const allowedRenderTags = useMemo(() => createAllowedRenderTagsFromConfig(annotationConfig), [annotationConfig]);
	const rootRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<HTMLPreElement>(null);
	const previewRef = useRef<HTMLPreElement>(null);

	useSyncScroll({
		refA: editorRef,
		refB: previewRef,
		axis: "x",
		syncOn: hast,
	});

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

		const document = fromMdxFlowElementToCodeDocument(codeBlockNode, annotationConfig);
		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document);
		const highlighedHast = highlight(payload.code, payload.lang || lang, payload.meta, {
			decorations: payload.decorations,
			lineDecorations: payload.lineDecorations,
			lineWrappers: [],
			allowedRenderTags,
		});

		setHast(highlighedHast);
	}, [codeBlockNode, lang, annotationConfig, allowedRenderTags]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || e.isComposing) return;
			const rootEl = rootRef.current;
			if (!rootEl || !editorRef.current) return;

			const targetNode = e.target instanceof Node ? e.target : null;
			const anchorNode = document.getSelection()?.anchorNode ?? null;
			const activeNode = document.activeElement;
			const isInsideThisEditor =
				(targetNode != null && rootEl.contains(targetNode)) ||
				(anchorNode != null && rootEl.contains(anchorNode)) ||
				(activeNode != null && rootEl.contains(activeNode));
			if (!isInsideThisEditor) return;

			editorRef.current.scrollLeft = 0;
			if (previewRef.current) {
				previewRef.current.scrollLeft = 0;
			}
		};

		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, []);

	return (
		<div ref={rootRef} className="relative rounded-lg *:m-0!">
			{hast && <HastView hast={hast} showLineNumbers={showLineNumbers} preRef={previewRef} />}
			<pre
				className={cn(
					"relative w-full overflow-x-auto overflow-y-hidden whitespace-pre outline-none",
					"bg-transparent! text-transparent! caret-black!",
					"[&_p]:whitespace-pre! [&_p]:my-0! [&_p]:min-w-fit!",
					showLineNumbers && "[&_p]:pl-7!",
				)}
				ref={editorRef}
			>
				<code className="block! min-w-fit">{nodeViewChildren}</code>
			</pre>
		</div>
	);
};
