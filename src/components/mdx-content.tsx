import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Code, CodeWithTooltips } from "./code";
import { CodeWithTabs } from "./code-handler";
import { Mermaid } from "./mermaid";

interface MDXContentProps {
	source: string;
	options?: MDXRemoteProps["options"];
}

export default function MDXContent({ source, options }: MDXContentProps) {
	return (
		<MDXRemote
			source={source}
			options={{
				...options,
				mdxOptions: {
					remarkPlugins: [remarkBreaks, remarkGfm, [remarkCodeHike, chConfig]],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				Code,
				Mermaid,
				CodeWithTabs,
				CodeWithTooltips,
				PureMdx: MDXContent,
			}}
		/>
	);
}

const chConfig: CodeHikeConfig = {
	components: { code: "Code" },
	ignoreCode: (codeblock) => codeblock.lang === "mermaid",
	syntaxHighlighting: {
		theme: "dark-plus",
	},
};
