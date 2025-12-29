import { fields } from "@keystatic/core";
import { codeBlockBlock } from "../blocks/code-block";
import { mermaidBlock } from "../blocks/mermaid-block";

export const mdx = (_args: Parameters<typeof fields.mdx>[0]) => {
	return fields.mdx({
		..._args,
		components: _args.components ?? {
			Mermaid: mermaidBlock,
			Code: codeBlockBlock,
		},
		options: { codeBlock: false },
	});
};
