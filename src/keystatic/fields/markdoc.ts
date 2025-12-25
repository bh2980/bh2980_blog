import { fields } from "@keystatic/core";

import { mermaidBlock } from "../blocks/mermaid-block";

export const markdoc = (_args: Parameters<typeof fields.markdoc>[0]) => {
	return fields.markdoc({
		..._args,
		components: _args.components ?? {
			Mermaid: mermaidBlock,
		},
	});
};
