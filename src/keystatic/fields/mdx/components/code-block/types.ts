import type { PropsWithChildren } from "react";
import type { EDITOR_LANG_OPTIONS } from "./constants";

export type CodeBlockSchema = {
	readonly id: string;
	readonly meta: { readonly title: string; readonly showLineNumbers: boolean };
	readonly lang: EditorCodeLang;
};

export type CodeBlockNodeViewProps = PropsWithChildren & {
	value: CodeBlockSchema;
	onChange(value: CodeBlockSchema): void;
	onRemove(): void;
	isSelected: boolean;
};

export type EditorCodeLang = (typeof EDITOR_LANG_OPTIONS)[number]["value"];
export type EditorLangOption = (typeof EDITOR_LANG_OPTIONS)[number];
