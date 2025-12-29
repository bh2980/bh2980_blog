import { fields } from "@keystatic/core";
import { wrapper } from "@keystatic/core/content-components";
import { CodeBlock } from "../fields/code-block/ui";

export const codeWithTabsBlock = wrapper({
	label: "Code with Tabs",
	schema: { mdx: fields.text({ label: "mdx", multiline: true }) },
	ContentView: (props) => <CodeBlock codeblock={{ value: props.value.mdx, lang: "md", meta: "" }} />,
});
