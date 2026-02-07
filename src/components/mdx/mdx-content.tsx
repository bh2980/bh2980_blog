import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { codeFenceAnnotationConfig } from "@/libs/annotation/code-block/constants";
import { rehypeMermaidDarkClass } from "@/libs/mermaid/rehype-mermaid-dark-class";
import { rehypeShikiDecorationRender } from "@/libs/shiki/rehype-shiki-decoration-render";
import { remarkAnnotationToShikiDecoration } from "@/libs/shiki/remark-annotation-to-decoration";
import { a } from "./a";
import { Callout } from "./callout";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { Pre } from "./pre";
import { Tab, Tabs } from "./tabs";
import { Tooltip } from "./tooltip";

export const renderMDX = async (source: string) => {
	const tocRef: TocItem[] = [];

	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [
					[remarkAnnotationToShikiDecoration, codeFenceAnnotationConfig],
					remarkBreaks,
					remarkGfm,
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings, rehypeShikiDecorationRender, rehypeMermaidDarkClass],
			},
		},
		components: {
			a,
			pre: Pre,
			Callout,
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
