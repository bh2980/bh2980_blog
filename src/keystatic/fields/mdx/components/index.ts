import { callout } from "./callout";
import { EDITOR_CODE_BLOCK_NAME, EditorCodeBlock } from "./code-block";
import { collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { del } from "./del";
import { em } from "./em";
import { IdeographicSpace } from "./ideographic-space";
import { EDITOR_MERMAID_NAME, EditorMermaid } from "./mermaid";
import { strong } from "./strong";
import { sub } from "./sub";
import { sup } from "./sup";
import { Tab, Tabs } from "./tabs";
import { tooltip } from "./tooltip";
import { u } from "./u";

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

	// mark : 위에 있을수록 우선 순위가 높다.
	Tooltip: tooltip,
	u,
	strong,
	em,
	del,
	sup,
	sub,
	IdeographicSpace,
};
