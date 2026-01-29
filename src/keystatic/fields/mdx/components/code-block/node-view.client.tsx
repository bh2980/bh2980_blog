"use client";

import { ListOrdered, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/utils/cn";
import { BlurChangeInput } from "./blur-change-input.client";
import type { CodeBlockNodeViewProps } from "./component";
import { EDITOR_LANG_OPTIONS, type EditorCodeLang, type EditorLangOption } from "./constants";
import { NodeViewCodeEditor } from "./node-view-code-editor.client";

const LANG_OPTION_BY_VALUE = new Map(EDITOR_LANG_OPTIONS.map((option) => [option.value, option]));
const FALLBACK_OPTIONS: [EditorCodeLang, EditorCodeLang, EditorCodeLang] = ["ts-tags", "tsx", "python"];

type Three<T> = readonly [T, T, T];

function toThree<T>(items: readonly T[], fallback: Three<T>): Three<T> {
	const a0 = items[0] ?? fallback[0];
	const a1 = items[1] ?? fallback[1];
	const a2 = items[2] ?? fallback[2];
	return [a0, a1, a2];
}

function getFallbackThree(lang: EditorCodeLang): Three<EditorCodeLang> {
	const unique = [...new Set<EditorCodeLang>([lang, ...FALLBACK_OPTIONS])];
	// 항상 길이 3을 타입/런타임 모두에서 보장
	const a0 = unique[0];
	const a1 = unique[1];
	const a2 = unique[2];
	return [a0, a1, a2];
}

const LanguageSelector = ({ value, onChange }: Pick<CodeBlockNodeViewProps, "value" | "onChange">) => {
	const fallback = getFallbackThree(value.lang);

	const [recentUsed, setRecentUsed] = useState<Three<EditorCodeLang>>(() => {
		try {
			const recentUsedStr = sessionStorage.getItem("recentUsed");

			const backupRecentUsed = JSON.parse(recentUsedStr ?? "[]");

			if (!Array.isArray(backupRecentUsed)) {
				throw new Error("recentUsed is not an array");
			}

			const filtered = backupRecentUsed.filter((lang): lang is EditorCodeLang => LANG_OPTION_BY_VALUE.has(lang));

			return toThree(filtered, fallback);
		} catch (_) {
			return fallback;
		}
	});
	const [searchValue, setSearchValue] = useState("");
	const searchResult = EDITOR_LANG_OPTIONS.filter(
		(lang) => lang.value.includes(searchValue) || lang.label.includes(searchValue),
	);

	const currentSelectLang = recentUsed[0];
	const selectedOption = LANG_OPTION_BY_VALUE.get(currentSelectLang);

	const selectedLabel = selectedOption?.label;
	const SelectedIcon = selectedOption?.icon;
	const selectedColor = selectedOption?.color;

	const groupedOptions = EDITOR_LANG_OPTIONS.reduce<Array<{ label: string; items: EditorLangOption[] }>>(
		(groups, option) => {
			const label = option.group ?? "기타";
			const existing = groups.find((group) => group.label === label);
			if (existing) {
				existing.items.push(option);
				return groups;
			}
			groups.push({ label, items: [option] });
			return groups;
		},
		[],
	);

	const handleLangChange = (lang: EditorCodeLang) => {
		setSearchValue("");
		setRecentUsed((prev) => {
			const nextArr = [lang, ...prev.filter((recentLang) => recentLang !== lang)];
			const next = toThree(nextArr, prev);
			sessionStorage.setItem("recentUsed", JSON.stringify(next));
			return next;
		});
	};

	const renderLangItem = (lang: EditorLangOption) => {
		const Icon = lang.icon;
		return (
			<DropdownMenuCheckboxItem
				key={lang.value}
				checked={currentSelectLang === lang.value}
				onCheckedChange={() => handleLangChange(lang.value)}
				className="text-xs"
			>
				<Icon className="size-3" style={{ color: lang.color }} />
				{lang.label}
			</DropdownMenuCheckboxItem>
		);
	};

	useEffect(() => {
		onChange({ ...value, lang: currentSelectLang });
	}, [currentSelectLang, onChange, value]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="w-[140px] justify-start gap-2 text-xs">
					{SelectedIcon ? <SelectedIcon className="mb-0.5 size-3" style={{ color: selectedColor }} /> : null}
					{selectedLabel}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<Input
					autoFocus
					className="h-7"
					placeholder="언어를 입력하세요"
					value={searchValue}
					onChange={(e) => setSearchValue(e.target.value)}
				/>
				<DropdownMenuSeparator />
				<div className={cn("hidden", searchValue && "block")}>
					{searchResult.length <= 0 ? (
						<p className="py-2 text-center text-muted-foreground text-sm">검색 결과 없음</p>
					) : (
						searchResult.map(renderLangItem)
					)}
				</div>
				<div className={cn(searchValue && "hidden")}>
					<DropdownMenuGroup>
						<DropdownMenuLabel className="text-xs">최근 사용</DropdownMenuLabel>
						{recentUsed
							.map((lang) => LANG_OPTION_BY_VALUE.get(lang))
							.filter((option): option is EditorLangOption => option !== undefined)
							.map(renderLangItem)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					{groupedOptions.map((group) => (
						<DropdownMenuSub key={group.label}>
							<DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>{group.items.map(renderLangItem)}</DropdownMenuSubContent>
						</DropdownMenuSub>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

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
	return (
		<div className="flex flex-col gap-2">
			<CodeBlockToolbar {...props} />
			<NodeViewCodeEditor
				nodeViewChildren={props.children}
				lang={props.value.lang}
				useLineNumber={props.value.meta.showLineNumbers}
			/>
		</div>
	);
};
