import { type CodeHikeConfig, recmaCodeHike, remarkCodeHike } from "codehike/mdx";
import { compileMDX, MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { rehypeMermaidDarkClass } from "@/libs/rehype/rehype-mermaid-dark-class";
import { remarkCodeBlockAnnotation } from "@/libs/remark/remark-code-block-annotation";
import { remarkMermaidComponentToCode } from "@/libs/remark/remark-mermaid-component-to-code";
import { a } from "./a";
import { Callout } from "./callout";
import { Code, CodeWithTooltips, InlineCode } from "./code";
import { CodeBlock } from "./code-block";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
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
					remarkPlugins: [remarkBreaks, remarkGfm, [remarkCodeHike, chConfig]],
					rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
					recmaPlugins: [[recmaCodeHike, chConfig]],
				},
			}}
			components={{
				Code,
				CodeWithTooltips,
				PureMdx: MDXContent,
				Callout,
				Collapsible,
				code: InlineCode,
				CodeBlock,
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
					remarkMermaidComponentToCode,
					remarkCodeBlockAnnotation,
					remarkBreaks,
					remarkGfm,
					[remarkCodeHike, chConfig],
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [
					rehypeSlug,
					rehypeAutolinkHeadings,
					[rehypeMermaid, { strategy: "img-svg", dark: true }],
					rehypeMermaidDarkClass,
				],
				recmaPlugins: [[recmaCodeHike, chConfig]],
			},
		},
		components: {
			Code,
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
			CodeBlock,
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
