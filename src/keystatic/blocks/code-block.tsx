import { block } from "@keystatic/core/content-components";
import { codeBlockField } from "../fields";
import { CodeBlock } from "../fields/code-block/ui";

export const codeBlockBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: codeBlockField({ label: "코드" }),
	},
	ContentView: ({ value }) => <CodeBlock codeblock={value.codeblock} />,
});
