"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { BlurChangeInput } from "./blur-change-input.client";
import type { CodeBlockNodeViewProps } from "./component";
import { EDITOR_LANG_OPTION, type EditorLang } from "./const";
import { NodeViewCodeEditor } from "./node-view-code-editor.client";

const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.match(/title="(.+?)"/)?.[1];

	const handleLangChange = (lang: EditorLang) => onChange({ ...value, lang });
	const handleLineNumberChange = (useLineNumber: boolean) => onChange({ ...value, useLineNumber });

	const handleBlurTitle = useCallback(
		(newTitle: string) => {
			const meta = value.meta.replace(/(title=")(.*?)(")/, `$1${newTitle}$3`);
			onChange({ ...value, meta });
		},
		[value, onChange],
	);

	return (
		<div className="flex justify-between">
			<div className="flex gap-2">
				<Select defaultValue={value.lang} onValueChange={handleLangChange}>
					<SelectTrigger size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{EDITOR_LANG_OPTION.map((lang) => (
							<SelectItem value={lang.value} key={lang.value}>
								{lang.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<BlurChangeInput defaultValue={title} onBlur={handleBlurTitle} />
			</div>
			<ButtonGroup>
				<Toggle size={"sm"} variant={"outline"} pressed={value.useLineNumber} onPressedChange={handleLineNumberChange}>
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
	return (
		<div>
			<CodeBlockToolbar {...props} />
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				useLineNumber={props.value.useLineNumber}
			/>
		</div>
	);
};
