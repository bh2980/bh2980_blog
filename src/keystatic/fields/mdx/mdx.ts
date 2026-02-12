import { fields } from "@keystatic/core";
import { components } from "./components";

export const mdx = (args: Parameters<typeof fields.mdx>[0]) => {
	const options = args.options ?? {};

	return fields.mdx({
		...args,
		components,
		options: {
			...options,
			heading: [2, 3],
			bold: false,
			italic: false,
			strikethrough: false,
			codeBlock: false,
		},
	});
};
