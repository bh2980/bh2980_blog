import { fields } from "@keystatic/core";
import { codeBlockBlock } from "../blocks/code-block";
import { codeWithTabsBlock } from "../blocks/code-with-tabs";
import { codeWithTooltipsBlock } from "../blocks/code-with-tooltips";
import { mermaidBlock } from "../blocks/mermaid-block";

export const mdx = (_args: Parameters<typeof fields.mdx>[0]) => {
	return fields.mdx({
		..._args,
		components: _args.components ?? {
			Mermaid: mermaidBlock,
			Code: codeBlockBlock,
			CodeWithTabs: codeWithTabsBlock,
			CodeWithTooltips: codeWithTooltipsBlock,
		},
		options: { codeBlock: false },
	});
};
