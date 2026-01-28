"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { type MouseEvent, useCallback } from "react";
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
import { EDITOR_LANG_OPTION, type EditorCodeLang, type EditorLangOption } from "./const";
import { NodeViewCodeEditor } from "./node-view-code-editor.client";

const LANG_OPTION_BY_VALUE = new Map(EDITOR_LANG_OPTION.map((option) => [option.value, option]));

const CodeBlockToolbar = ({ value, onChange, onRemove }: CodeBlockNodeViewProps) => {
	const title = value.meta.match(/title="(.+?)"/)?.[1];
	const selectedOption = LANG_OPTION_BY_VALUE.get(value.lang);
	const selectedLabel = selectedOption?.label ?? value.lang;
	const SelectedIcon = selectedOption?.icon;
	const selectedColor = selectedOption?.color;
	const defaultOptions = EDITOR_LANG_OPTION.filter((option) => option.depth === 1);
	const groupedOptions = EDITOR_LANG_OPTION.filter((option) => option.depth === 2).reduce<
		Array<{ label: string; items: EditorLangOption[] }>
	>((groups, option) => {
		const label = option.group ?? "기타";
		const existing = groups.find((group) => group.label === label);
		if (existing) {
			existing.items.push(option);
			return groups;
		}
		groups.push({ label, items: [option] });
		return groups;
	}, []);

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

	const renderLangItem = (lang: EditorLangOption) => {
		const Icon = lang.icon;
		return (
			<DropdownMenuCheckboxItem
				key={lang.value}
				checked={value.lang === lang.value}
				onCheckedChange={() => handleLangChange(lang.value)}
			>
				<Icon className="size-3" style={{ color: lang.color }} />
				{lang.label}
			</DropdownMenuCheckboxItem>
		);
	};

	return (
		<div className="flex justify-between">
			<div className="flex gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="w-[140px] justify-start" onMouseDown={stop}>
							{SelectedIcon ? <SelectedIcon className="size-3" style={{ color: selectedColor }} /> : null}
							{selectedLabel}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent onMouseDown={stop} data-ks-stop-event>
						{defaultOptions.map(renderLangItem)}
						{groupedOptions.length > 0 && <DropdownMenuSeparator />}
						{groupedOptions.map((group) => (
							<DropdownMenuSub key={group.label}>
								<DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>{group.items.map(renderLangItem)}</DropdownMenuSubContent>
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
