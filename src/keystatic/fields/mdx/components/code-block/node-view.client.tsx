"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
	useWrapperToolbarPortalSnapshot,
	WRAPPER_TOOLBAR_NODE_ID_ATTR,
} from "@/keystatic/plugins/pm/wrapper-toolbar-portal-store";
import { cn } from "@/utils/cn";
import type { CodeBlockNodeViewProps } from "./component";
import { CodeBlockToolbar, NodeViewCodeEditor } from "./components";

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const latestValueRef = useRef(props.value);
	const wrapperNodeId = useId();
	const toolbarState = useWrapperToolbarPortalSnapshot();

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
			{...{ [WRAPPER_TOOLBAR_NODE_ID_ATTR]: wrapperNodeId }}
			className={cn("relative flex flex-col gap-2 rounded-lg", props.isSelected && "outline-2 outline-offset-8")}
		>
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				showLineNumbers={props.value.meta.showLineNumbers}
				proseMirrorId={props.value.id}
				initProseMirrorId={initProseMirrorId}
			/>
			{toolbarState.host && toolbarState.activeWrapperId === wrapperNodeId
				? createPortal(<CodeBlockToolbar {...props} />, toolbarState.host)
				: null}
		</div>
	);
};
