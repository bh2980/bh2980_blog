import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import { Code } from "./code";
import Mermaid from "./mermaid";

interface MDXContentProps {
	source: string;
	options?: MDXRemoteProps["options"];
	className?: string;
}

export default function MDXContent({ source, options, className }: MDXContentProps) {
	return (
		<MDXRemote
			source={source}
			options={{
				...options,
				mdxOptions: {
					remarkPlugins: [[remarkCodeHike, chConfig]],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				wrapper: ({ children }) => <div className={className}>{children}</div>,
				Code,
				Mermaid,
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
