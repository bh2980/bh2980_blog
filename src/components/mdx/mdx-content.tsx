import type { Root, Text } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkFlexibleToc, { type HeadingDepth, type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";
import { analyze } from "@/cms/mdx";
import type { ImageResolver } from "@/cms/mdx/image-src";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "@/cms/mdx/remark-directives";
import { annotationConfig } from "@/libs/annotation/code-block/constants";
import { remarkChartToMdx } from "@/libs/chart";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
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
import { CmsImage } from "./image";
import { Mermaid } from "./mermaid.client";
import { pre } from "./pre";
import { Table, TableCell, TableRow } from "./table";
import { Tab, Tabs } from "./tabs";
import { TextAlign } from "./text-align";
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
	// directive 읽기(추가형). demote가 미등록 이름을 본문 텍스트로 되돌린 뒤 등록 이름만 MDX 요소로 바꾼다.
	// 순서를 뒤집으면 미등록 이름이 directive로 남아 아무것도 출력되지 않는다(무음 손실).
	remarkDirective,
	remarkDemoteUnknownDirectives,
	remarkDirectivesToMdx,
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
	TextAlign,
	Image: CmsImage,
	Table,
	TableRow,
	TableCell,
};

/**
 * 이미지 주소 해석기를 주입한 컴포넌트 표.
 *
 * `CmsImage`는 DB를 직접 읽지 않는다 — 호출자가 resolver를 넘긴다(A3). 주지 않으면 외부 `src`만 해석한다.
 */
export type MdxRenderOptions = {
	imageResolver?: ImageResolver;
	/** 공개 화면의 언어(v2 B4). 컴포넌트의 고정 문구를 그 언어로 쓴다. */
	locale?: Locale;
	/** 사이트 내부 링크를 이 언어 주소로 바꾼다(같은 언어 번역본이 있을 때). */
	resolveHref?: (href: string) => string;
};

export const createMdxComponents = (options: MdxRenderOptions = {}) => {
	const t = translator(options.locale ?? DEFAULT_LOCALE);
	const resolveHref = options.resolveHref;
	return {
		...MDX_COMPONENTS,
		...(resolveHref
			? { a: (props: ComponentProps<typeof a>) => a({ ...props, href: resolveHref(props.href ?? "") }) }
			: {}),
		Collapsible: (props: ComponentProps<typeof Collapsible>) => (
			<Collapsible {...props} fallbackTitle={t("mdx.expand")} />
		),
		Image: (props: ComponentProps<typeof CmsImage>) => (
			<CmsImage {...props} resolve={options.imageResolver} unavailableLabel={t("mdx.imageUnavailable")} />
		),
	};
};

export const renderMDX = async (source: string, options: MdxRenderOptions = {}) => {
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
		components: createMdxComponents(options),
	});

	const toc = tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as HeadingDepth }));

	return { content, toc };
};
