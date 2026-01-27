import { callout } from "./callout";
import { codeblock as codeblock_deprecated } from "./code";
import { EDITOR_CODE_BLOCK_NAME, EditorCodeBlock } from "./code-block";
import { collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { EDITOR_MERMAID_NAME, EditorMermaid } from "./mermaid";
import { pureMDX } from "./pure-mdx";
import { Tab, Tabs } from "./tabs";
import { tooltip } from "./tooltip";
import { underline } from "./underline";

export const components = {
	// wrapper
	Callout: callout,
	Collapsible: collapsible,
	Columns,
	Column,
	Tabs,
	Tab,
	[EDITOR_CODE_BLOCK_NAME]: EditorCodeBlock,
	[EDITOR_MERMAID_NAME]: EditorMermaid,

	// wrapper deprecated
	Code: codeblock_deprecated,
	PureMdx: pureMDX,

	// mark : 위에 있을수록 우선 순위가 높다.
	Tooltip: tooltip,
	u: underline,
};
