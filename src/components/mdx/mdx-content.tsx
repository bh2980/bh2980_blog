import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { compileMDX, MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { remarkCodeblockAnnotation } from "@/libs/contents/remark";
import { a } from "./a";
import { Callout } from "./callout";
import { Code, CodeWithTooltips, InlineCode } from "./code";
import { Codeblock } from "./code-block";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { Mermaid } from "./mermaid.client";
import { Tab, Tabs } from "./tabs";
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
					remarkPlugins: [remarkCodeblockAnnotation, remarkBreaks, remarkGfm, [remarkCodeHike, chConfig]],
					rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				Code,
				Mermaid,
				CodeWithTooltips,
				PureMdx: MDXContent,
				Callout,
				Collapsible,
				code: InlineCode,
				Codeblock,
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
					remarkCodeblockAnnotation,
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
			CodeWithTooltips,
			PureMdx: MDXContent,
			Callout,
			Collapsible,
			code: InlineCode,
			Tooltip,
			a,
			Columns,
			Column,
			Tabs,
			Tab,
			Codeblock,
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
