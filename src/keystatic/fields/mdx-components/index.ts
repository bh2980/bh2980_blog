import { editorCallout } from "./editor-callout";
import { editorCodeBlock } from "./editor-code-block";
import { editorMermaidBlock } from "./editor-mermaid-block";
import { editorPureMdxBlock } from "./editor-pure-mdx-block";

export const components = {
	Callout: editorCallout,
	Code: editorCodeBlock,
	Mermaid: editorMermaidBlock,
	// PureMdx: editorPureMdxBlock,
};
