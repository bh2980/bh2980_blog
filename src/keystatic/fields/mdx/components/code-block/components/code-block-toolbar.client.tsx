"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Toggle } from "@/components/ui/toggle";
import type { CodeBlockNodeViewProps } from "../component";
import { BlurChangeInput } from "./blur-change-input.client";
import { LanguageSelector } from "./language-selector.client";

export const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.title;

	const handleLineNumberChange = (showLineNumbers: boolean) =>
		onChange({ ...value, meta: { ...value.meta, showLineNumbers } });
	const handleBlurTitle = (title: string) => onChange({ ...value, meta: { ...value.meta, title } });

	return (
		<div
			className="pointer-events-auto absolute right-2 -bottom-[120%] left-2 flex justify-between rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur-sm"
			data-wrapper-toolbar-ui
		>
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
