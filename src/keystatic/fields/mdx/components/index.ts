import { callout } from "./callout";
import { codeblock as codeblock_deprecated } from "./code";
import { EDITOR_CODE_BLOCK_NAME, EditorCodeBlock } from "./code-block";
import { collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { mermaid } from "./mermaid";
import { pureMDX } from "./pure-mdx";
import { Tab, Tabs } from "./tabs";
import { tooltip } from "./tooltip";
import { underline } from "./underline";

export const components = {
	Callout: callout,
	Collapsible: collapsible,
	Code: codeblock_deprecated,
	Mermaid: mermaid,
	PureMdx: pureMDX,
	Tooltip: tooltip,
	u: underline,
	[EDITOR_CODE_BLOCK_NAME]: EditorCodeBlock,
	Columns,
	Column,
	Tabs,
	Tab,
};
