import { block } from "@keystatic/core/content-components";
import { codePreview } from "../fields/code-preview";
import { CodePreview } from "../fields/code-preview/ui";

export const codeBlock = block({
	label: "코드 블럭",
	schema: {
		codeblock: codePreview({ label: "코드" }),
	},
	ContentView: ({ value }) => <CodePreview codeblock={value.codeblock} />,
});
