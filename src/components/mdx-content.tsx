import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { remarkCodeWithTabs, remarkCodeWithTooltips } from "@/keystatic/libs/mdx";
import { Code, CodeWithTooltips } from "./code";
import { CodeWithTabs } from "./code-handler";
import { Mermaid } from "./mermaid";

interface MDXContentProps {
	source: string;
	options?: MDXRemoteProps["options"];
	className?: string;
}

export default function MDXContent({ source, options }: MDXContentProps) {
	return (
		<MDXRemote
			source={source}
			options={{
				...options,
				mdxOptions: {
					remarkPlugins: [
						remarkCodeWithTabs,
						remarkCodeWithTooltips,
						remarkBreaks,
						remarkGfm,
						[remarkCodeHike, chConfig],
					],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				Code,
				Mermaid,
				CodeWithTabs,
				CodeWithTooltips,
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
