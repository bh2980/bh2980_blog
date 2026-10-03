"use client";

import type { NodeViewProps } from "@tiptap/react";
import { type FenceEditorMeta, FencePreviewNodeView } from "./fence-preview-node-view";
import { MathPreview } from "./preview-renderers";

const MATH_META: FenceEditorMeta = {
	kind: "math",
	label: "수식",
	placeholder: "E = mc^2",
	preview: (value) => <MathPreview value={value} />,
};

/** 수식 블록(`$$`) 편집 화면. */
export function MathNodeView(props: NodeViewProps) {
	return <FencePreviewNodeView {...props} meta={MATH_META} />;
}
