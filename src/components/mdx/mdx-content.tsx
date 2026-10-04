import type { ImageResolver } from "@bh2980/cms/mdx";
import { type MdxComponents, mdxRehypePlugins, mdxRemarkPlugins, renderMdx } from "@bh2980/cms/render";
import type { ComponentProps } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { a } from "./a";
import { Callout } from "./callout";
import { Chart } from "./chart";
import { collapse } from "./code-block/collapse";
import { fold } from "./code-block/fold";
import { CodeRef } from "./code-ref.client";
import { Collapsible } from "./collapsible";
import { Color } from "./color";
import { Column, Columns } from "./columns";
import { CmsFile } from "./file";
import { CmsImage } from "./image";
import { Mermaid } from "./mermaid.client";
import { pre } from "./pre";
import { Table, TableCell, TableRow } from "./table";
import { Tab, Tabs } from "./tabs";
import { TextAlign } from "./text-align";
import { Tooltip } from "./tooltip";

/** 공개 렌더 체인의 remark·rehype 플러그인(본체 `@bh2980/cms/render`와 같다). 검수 러너가 같은 구성을 쓴다. */
export const MDX_REMARK_PLUGINS = mdxRemarkPlugins;
export const MDX_REHYPE_PLUGINS = mdxRehypePlugins();

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
	CodeRef,
	Color,
	// 번역 안내 글(v3)은 공개 화면에 보이지 않는다. 남은 채로 발행하지 않게 발행 전 검사가 막는다.
	Untranslated: () => null,
	Tabs,
	Tab,
	TextAlign,
	Image: CmsImage,
	// 주소 해석기가 없는 곳(원문 미리보기 등)에서는 이름만 보인다.
	File: (props: { mediaId?: string; label?: string }) => (
		<CmsFile {...props} downloadLabel="내려받기" unavailableLabel="파일" />
	),
	Table,
	TableRow,
	TableCell,
	// GFM 표의 첫 행 머리글은 열 머리글이다. directive 표는 TableCell에서 행·열을 판별한다.
	th: ({ scope, ...props }: ComponentProps<"th">) => <th {...props} scope={scope ?? "col"} />,
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
		File: (props: { mediaId?: string; label?: string }) => (
			<CmsFile
				{...props}
				resolve={options.imageResolver}
				downloadLabel={t("mdx.download")}
				unavailableLabel={t("mdx.fileUnavailable")}
			/>
		),
	};
};

/**
 * 블로그 공개 본문. 순서·검사는 본체 `renderMdx`가 하고, 컴포넌트는 블로그 것(모양)을 넘긴다.
 * 링크 바꾸기(`resolveHref`)는 블로그 `a`가 한다.
 */
export const renderMDX = async (source: string, options: MdxRenderOptions = {}) => {
	const t = translator(options.locale ?? DEFAULT_LOCALE);
	const { content, toc } = await renderMdx(source, {
		imageResolver: options.imageResolver,
		locale: options.locale,
		components: createMdxComponents(options) as MdxComponents,
		labels: {
			imageUnavailable: t("mdx.imageUnavailable"),
			fileUnavailable: t("mdx.fileUnavailable"),
			download: t("mdx.download"),
		},
	});
	return { content, toc: [...toc] };
};
