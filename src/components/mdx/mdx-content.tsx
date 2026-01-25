import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { compileMDX, MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { a } from "./a";
import { Callout } from "./callout";
import { Code, CodeWithTooltips, InlineCode } from "./code";
import { CodeWithTabs } from "./code-handler";
import { Collapsible } from "./collapsible";
import { Mermaid } from "./mermaid.client";
import { Tooltip } from "./tooltip";

interface MDXContentProps {
	source: string;
	options?: MDXRemoteProps["options"];
}

/**
 * @deprecated
 */
export default function MDXContent({ source, options }: MDXContentProps) {
	return (
		<MDXRemote
			source={source}
			options={{
				...options,
				mdxOptions: {
					remarkPlugins: [remarkBreaks, remarkGfm, [remarkCodeHike, chConfig]],
					rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				Code,
				Mermaid,
				CodeWithTabs,
				CodeWithTooltips,
				PureMdx: MDXContent,
				Callout,
				Collapsible,
				code: InlineCode,
				Tooltip,
			}}
		/>
	);
}

export const renderMDX = async (source: string) => {
	const tocRef: TocItem[] = [];

	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [
					remarkBreaks,
					remarkGfm,
					[remarkCodeHike, chConfig],
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
				recmaPlugins: [[recmaCodeHike, chConfig]],
			},
		},
		components: {
			Code,
			Mermaid,
			CodeWithTabs,
			CodeWithTooltips,
			PureMdx: MDXContent,
			Callout,
			Collapsible,
			code: InlineCode,
			Tooltip,
			a,
		},
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};

const chConfig: CodeHikeConfig = {
	components: { code: "Code" },
	ignoreCode: (codeblock) => codeblock.lang === "mermaid",
	syntaxHighlighting: {
		theme: "dark-plus",
	},
};
