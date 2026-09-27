export type CodeBlockAnnotationType = "underline" | "tooltip";

export interface CodeBlockAnnotationItem {
	id: string;
	type: CodeBlockAnnotationType;
	from: number;
	to: number;
	content?: string;
}

export interface ParsedCodeBlockMeta {
	title: string;
	showLineNumbers: boolean;
	raw: Record<string, unknown>;
}

export interface CodeLanguageOption {
	label: string;
	value: string;
}
