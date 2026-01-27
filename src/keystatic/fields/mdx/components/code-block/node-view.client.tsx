"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { useCallback, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { BlurChangeInput } from "./blur-change-input.client";
import type { CodeBlockNodeViewProps } from "./component";
import {
	EDITOR_LANG_DEFAULTS,
	EDITOR_LANG_GROUPS,
	EDITOR_LANG_OPTION,
	type EditorCodeLang,
} from "./const";
import { NodeViewCodeEditor } from "./node-view-code-editor.client";

const LANG_OPTION_BY_VALUE = new Map(EDITOR_LANG_OPTION.map((option) => [option.value, option]));

const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.match(/title="(.+?)"/)?.[1];
	const selectedLabel = LANG_OPTION_BY_VALUE.get(value.lang)?.label ?? value.lang;
	const defaultOptions = EDITOR_LANG_DEFAULTS.map((lang) => LANG_OPTION_BY_VALUE.get(lang)).filter(
		(lang): lang is (typeof EDITOR_LANG_OPTION)[number] => Boolean(lang),
	);
	const groupedOptions = EDITOR_LANG_GROUPS.map((group) => ({
		label: group.label,
		items: group.values
			.map((lang) => LANG_OPTION_BY_VALUE.get(lang))
			.filter((lang): lang is (typeof EDITOR_LANG_OPTION)[number] => Boolean(lang)),
	})).filter((group) => group.items.length > 0);

	const handleLangChange = (lang: EditorCodeLang) => onChange({ ...value, lang });
	const handleLineNumberChange = (useLineNumber: boolean) => onChange({ ...value, useLineNumber });

	const handleBlurTitle = useCallback(
		(newTitle: string) => {
			const meta = value.meta.replace(/(title=")(.*?)(")/, `$1${newTitle}$3`);
			onChange({ ...value, meta });
		},
		[value, onChange],
	);

	const stop = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		event.nativeEvent?.stopImmediatePropagation?.();
	};

	return (
		<div className="flex justify-between">
			<div className="flex gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-[180px] justify-between"
							onMouseDown={stop}
							data-ks-stop-event
						>
							{selectedLabel}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent onMouseDown={stop} data-ks-stop-event>
						{defaultOptions.map((lang) => (
							<DropdownMenuCheckboxItem
								key={lang.value}
								checked={value.lang === lang.value}
								onCheckedChange={() => handleLangChange(lang.value)}
							>
								{lang.label}
							</DropdownMenuCheckboxItem>
						))}
						{groupedOptions.length > 0 && <DropdownMenuSeparator />}
						{groupedOptions.map((group) => (
							<DropdownMenuSub key={group.label}>
								<DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									{group.items.map((lang) => (
										<DropdownMenuCheckboxItem
											key={lang.value}
											checked={value.lang === lang.value}
											onCheckedChange={() => handleLangChange(lang.value)}
										>
											{lang.label}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
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
		<div className="flex flex-col gap-2">
			<CodeBlockToolbar {...props} />
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				useLineNumber={props.value.useLineNumber}
			/>
		</div>
	);
};
