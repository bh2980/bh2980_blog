"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import type { CodeBlockNodeViewProps } from "./component";
import { CodeBlockToolbar, NodeViewCodeEditor } from "./components";

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const latestValueRef = useRef(props.value);

	useEffect(() => {
		latestValueRef.current = props.value;
	}, [props.value]);

	const initProseMirrorId = (id: string) => {
		const latestValue = latestValueRef.current;
		if (latestValue.id === id) {
			return;
		}

		props.onChange({ ...latestValue, id });
	};

	return (
		<div
			data-wrapper-toolbar-node="CodeBlock"
			className={cn("relative flex flex-col gap-2 rounded-lg pb-14", props.isSelected && "outline-2 outline-offset-8")}
		>
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				showLineNumbers={props.value.meta.showLineNumbers}
				proseMirrorId={props.value.id}
				initProseMirrorId={initProseMirrorId}
			/>
			<div
				data-wrapper-toolbar-ui
				data-ks-stop-event
				className="pointer-events-auto absolute right-2 bottom-2 left-2 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm"
			>
				<CodeBlockToolbar {...props} />
			</div>
		</div>
	);
};
