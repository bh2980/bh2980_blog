import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { rehypeShikiDecorationRender } from "@/libs/shiki/rehype-shiki-decoration-render";
import { remarkAnnotationToShikiDecoration } from "@/libs/shiki/remark-annotation-to-decoration";
import { a } from "./a";
import { Callout } from "./callout";
import { collapse } from "./code-block/collapse";
import { fold } from "./code-block/fold";
import { Collapsible } from "./collapsible";
import { Column, Columns } from "./columns";
import { IdeographicSpace } from "./ideographic-space";
import { pre } from "./pre";
import { Tab, Tabs } from "./tabs";
import { Tooltip } from "./tooltip";

export const renderMDX = async (source: string) => {
	const tocRef: TocItem[] = [];

	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [
					[remarkAnnotationToShikiDecoration, annotationConfig],
					remarkBreaks,
					remarkGfm,
					[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
				],
				rehypePlugins: [
					rehypeSlug,
					rehypeAutolinkHeadings,
					[rehypeShikiDecorationRender, { ignoreLang: (lang: string) => lang.toLowerCase() === "mermaid" }],
				],
			},
		},
		components: {
			IdeographicSpace,
			a,
			pre,
			collapse,
			fold,

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
