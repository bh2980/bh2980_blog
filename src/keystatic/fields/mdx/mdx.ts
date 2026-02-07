import { fields } from "@keystatic/core";
import { components } from "./components";

export const mdx = (_args: Parameters<typeof fields.mdx>[0]) => {
	return fields.mdx({
		..._args,
		components,
		options: {
			bold: false,
			italic: false,
			strikethrough: false,
			code: false,
			codeBlock: false,
		},
	});
};
