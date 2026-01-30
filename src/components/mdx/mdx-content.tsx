import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import javascript from "@shikijs/langs/javascript";
import jsonc from "@shikijs/langs/jsonc";
import python from "@shikijs/langs/python";
import scss from "@shikijs/langs/scss";
import solidity from "@shikijs/langs/solidity";
import sql from "@shikijs/langs/sql";
import tsTags from "@shikijs/langs/ts-tags";
import tsx from "@shikijs/langs/tsx";
import yaml from "@shikijs/langs/yaml";
import oneDarkPro from "@shikijs/themes/one-dark-pro";

import { compileMDX, MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { getSingletonHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { annotationConfig } from "@/keystatic/libs/serialize-annotations";
import { rehypeMermaidDarkClass } from "@/libs/rehype/rehype-mermaid-dark-class";
import { rehypeShikiDecorationRender } from "@/libs/rehype/rehype-shiki-decoration-render";
import { remarkAnnotationToShikiDecoration } from "@/libs/remark/remark-annotation-to-decoration";
import { remarkMermaidComponentToCode } from "@/libs/remark/remark-mermaid-component-to-code";
import { a } from "./a";
import { Callout } from "./callout";
import { Code, CodeWithTooltips, InlineCode } from "./code";
import { CodeBlock } from "./code-block";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { Tab, Tabs } from "./tabs";
import { Tooltip } from "./tooltip";

const highlighter = await getSingletonHighlighterCore({
	themes: [oneDarkPro],
	langs: [tsTags, javascript, tsx, css, scss, python, solidity, jsonc, yaml, sql, bash],
	engine: createJavaScriptRegexEngine(),
});

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
					[rehypeShikiDecorationRender, { highlighter, theme: oneDarkPro }],
					[rehypeMermaid, { strategy: "img-svg", dark: true }],
					rehypeMermaidDarkClass,
				],
			},
		},
		components: {
			a,
			Callout,
			Collapsible,
			Columns,
			Column,
			CodeBlock,
			Code,
			CodeWithTooltips,
			PureMdx: MDXContent,
			Tooltip,
			Tabs,
			Tab,
		},
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};
