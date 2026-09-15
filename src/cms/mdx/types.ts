import type { Root } from "mdast";

export type CmsMdxPosition = {
	line: number;
	column: number;
};

export type CmsMdxError = {
	message: string;
	position: CmsMdxPosition;
};

export type CmsJsonValue = string | number | boolean | null | CmsJsonValue[] | { [key: string]: CmsJsonValue };

export type CmsJsxAttribute = {
	name?: string;
	value?: CmsJsonValue;
	expression?: string;
	spread?: boolean;
};

export type CmsMark = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
};

export type CmsNode = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
	content?: CmsNode[];
	marks?: CmsMark[];
	text?: string;
};

export type CmsMdxAnalysis = {
	source: string;
	errors: CmsMdxError[];
	name?: string;
	frontmatter: Record<string, CmsJsonValue> | null;
	tree: Root | null;
};
