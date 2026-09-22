import type { Root, Text } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";
import { analyze } from "@/cms/mdx";
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

/** 공개 렌더 체인의 remark 플러그인. 검수 러너가 같은 구성을 재사용한다. */
export const MDX_REMARK_PLUGINS = (tocRef: TocItem[] = []): PluggableList => [
	[remarkAnnotationToShikiDecoration, annotationConfig],
	// 본문의 단일 `$`(예: jQuery `$`)를 수식으로 오인하지 않게 CMS 파서와 동일하게 맞춘다.
	[remarkMath, { singleDollarTextMath: false }],
	remarkDisableInlineMath,
	remarkChartToMdx,
	remarkMermaidToMdx,
	remarkBreaks,
	remarkGfm,
	[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
];

/** 공개 렌더 체인의 rehype 플러그인. */
export const MDX_REHYPE_PLUGINS: PluggableList = [
	rehypeSlug,
	rehypeAutolinkHeadings,
	[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }],
	[rehypeShikiDecorationRender, { ignoreLang: (lang: string) => lang.toLowerCase() === "mermaid" }],
];

/** 공개 페이지가 쓰는 MDX 컴포넌트 표. */
export const MDX_COMPONENTS = {
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
};

export const renderMDX = async (source: string) => {
	// M7-SEC-1 조건 3: 검증을 통과하지 못한 MDX는 실행 컴파일러에 넣지 않는다(fail-closed).
	// 저장·발행 경계(`assertPublishableMdx`)를 지나온 본문이라도 여기서 한 번 더 막는다.
	const errors = analyze(source).errors;

	if (errors.length > 0) {
		throw new Error(`MDX validation failed: ${errors[0]?.message ?? "unknown"}`);
	}

	const tocRef: TocItem[] = [];

	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: MDX_REMARK_PLUGINS(tocRef),
				rehypePlugins: MDX_REHYPE_PLUGINS,
			},
		},
		components: MDX_COMPONENTS,
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};
