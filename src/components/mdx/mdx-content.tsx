import type { Root, Text } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { remarkChartToMdx } from "@/libs/chart";
import { remarkMermaidToMdx } from "@/libs/mermaid/remark-mermaid-to-mdx";
import { rehypeShikiDecorationRender } from "@/libs/shiki/rehype-shiki-decoration-render";
import { remarkAnnotationToShikiDecoration } from "@/libs/shiki/remark-annotation-to-decoration";
import { a } from "./a";
import { Callout } from "./callout";
import { Chart } from "./chart";
import { collapse } from "./code-block/collapse";
import { fold } from "./code-block/fold";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { IdeographicSpace } from "./ideographic-space";
import { Mermaid } from "./mermaid.client";
import { pre } from "./pre";
import { Tab, Tabs } from "./tabs";
import { Tooltip } from "./tooltip";

const remarkDisableInlineMath = () => {
	return (tree: Root) => {
		visit(tree, "inlineMath", (node, index, parent) => {
			if (index == null || !parent) return;

			parent.children.splice(index, 1, {
				type: "text",
				value: `$${node.value}$`,
			} satisfies Text);
		});
	};
};

export const renderMDX = async (source: string) => {
	const tocRef: TocItem[] = [];

	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [
					[remarkAnnotationToShikiDecoration, annotationConfig],
					remarkMath,
					remarkDisableInlineMath,
					remarkChartToMdx,
					remarkMermaidToMdx,
					remarkBreaks,
					remarkGfm,
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [
					rehypeSlug,
					rehypeAutolinkHeadings,
					[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }],
					[rehypeShikiDecorationRender, { ignoreLang: (lang: string) => lang.toLowerCase() === "mermaid" }],
				],
			},
		},
		components: {
			IdeographicSpace,
			a,
			pre,
			Mermaid,
			collapse,
			fold,

			Callout,
			Chart,
			Collapsible,
			Columns,
			Column,
			Tooltip,
			Tabs,
			Tab,
		},
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};
