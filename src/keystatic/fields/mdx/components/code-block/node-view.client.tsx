"use client";

import type { AnnotationConfig } from "@/keystatic/libs/serialize-annotations";
import { cn } from "@/utils/cn";
import type { CodeBlockNodeViewProps } from "./component";
import { CodeBlockToolbar, NodeViewCodeEditor } from "./components";

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const initProseMirrorId = (id: string) => {
		props.onChange({ ...props.value, id });
	};
	return (
		<div className={cn("flex flex-col gap-2 rounded-lg", props.isSelected && "outline-2 outline-offset-8")}>
			<CodeBlockToolbar {...props} />
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				showLineNumbers={props.value.meta.showLineNumbers}
				proseMirrorId={props.value.id}
				initProseMirrorId={initProseMirrorId}
			/>
		</div>
	);
};
