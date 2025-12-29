import { fields } from "@keystatic/core";
import { editorCodeBlock } from "../blocks/editor-code-block";
import { editorMermaidBlock } from "../blocks/editor-mermaid-block";
import { editorPureMdxBlock } from "./../blocks/editor-pure-mdx-block";

export const mdx = (_args: Parameters<typeof fields.mdx>[0]) => {
	return fields.mdx({
		..._args,
		components: _args.components ?? {
			Mermaid: editorMermaidBlock,
			Code: editorCodeBlock,
			PureMdx: editorPureMdxBlock,
		},
	});
};
