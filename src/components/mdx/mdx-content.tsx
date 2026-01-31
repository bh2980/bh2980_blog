import { compileMDX, MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { annotationConfig } from "@/keystatic/libs/serialize-annotations";
import { rehypeMermaidDarkClass } from "@/libs/mermaid/rehype-mermaid-dark-class";
import { remarkMermaidComponentToCode } from "@/libs/mermaid/remark-mermaid-component-to-code";
import { rehypeShikiDecorationRender } from "@/libs/shiki/rehype-shiki-decoration-render";
import { remarkAnnotationToShikiDecoration } from "@/libs/shiki/remark-annotation-to-decoration";
import { a } from "./a";
import { Callout } from "./callout";
import { Code, CodeWithTooltips, InlineCode } from "./code";
import { CodeBlock } from "./code-block";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { Pre } from "./pre";
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
					remarkPlugins: [remarkBreaks, remarkGfm],
					rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
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
					[remarkAnnotationToShikiDecoration, annotationConfig],
					remarkBreaks,
					remarkGfm,
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [
					rehypeSlug,
					rehypeAutolinkHeadings,
					rehypeShikiDecorationRender,
					[rehypeMermaid, { strategy: "img-svg", dark: true }],
					rehypeMermaidDarkClass,
				],
			},
		},
		components: {
			a,
			pre: Pre,
			Callout,
			Collapsible,
			Columns,
			Column,
			CodeBlock,
			Tooltip,
			Tabs,
			Tab,

			// deprecated
			Code,
			CodeWithTooltips,
			PureMdx: MDXContent,
		},
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};
