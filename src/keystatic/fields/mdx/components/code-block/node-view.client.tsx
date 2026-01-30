"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/utils/cn";
import { BlurChangeInput } from "./blur-change-input.client";
import type { CodeBlockNodeViewProps } from "./component";
import { LanguageSelector } from "./language-selector";
import { NodeViewCodeEditor } from "./node-view-code-editor.client";

const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.title;

	const handleLineNumberChange = (showLineNumbers: boolean) =>
		onChange({ ...value, meta: { ...value.meta, showLineNumbers } });
	const handleBlurTitle = (title: string) => onChange({ ...value, meta: { ...value.meta, title } });

	return (
		<div className="flex justify-between">
			<div className="flex gap-2">
				<LanguageSelector value={value} onChange={onChange} />
				<BlurChangeInput defaultValue={title} onBlur={handleBlurTitle} />
			</div>
			<ButtonGroup>
				<Toggle
					size={"sm"}
					variant={"outline"}
					pressed={value.meta.showLineNumbers}
					onPressedChange={handleLineNumberChange}
				>
					<ListOrdered />
				</Toggle>
				<Button variant={"destructive"} onClick={onRemove} size="icon-sm">
					<Trash2 />
				</Button>
			</ButtonGroup>
		</div>
	);
};

export const CodeBlockNodeView = (props: CodeBlockNodeViewProps) => {
	const subscriptionId = useRef(crypto.randomUUID());

	// biome-ignore lint/correctness/useExhaustiveDependencies: id가 없을 경우에 최초 부여용
	useEffect(() => {
		if (props.value.id) {
			return;
		}

		props.onChange({ ...props.value, id: subscriptionId.current });
	}, [props.value.id]);

	return (
		<div className={cn("flex flex-col gap-2 rounded-lg", props.isSelected && "outline-2 outline-offset-8")}>
			<CodeBlockToolbar {...props} />
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				useLineNumber={props.value.meta.showLineNumbers}
			/>
		</div>
	);
};
