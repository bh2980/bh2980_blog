import type { Root } from "mdast";
import type { Schema } from "prosemirror-model";
import type { ExtraPluginsSlots } from "@/keystatic/plugins";

type HookCtx = { slug?: string };

type KSMdxHooks = {
	/**
	 * fromMarkdown 이전: mdx 문자열 전처리
	 * (예: 커스텀 pragma 치환, frontmatter 정리 등)
	 */
	beforeParse?: (mdx: string, ctx: HookCtx) => string | undefined;

	/**
	 * fromMarkdown 이후: mdast 전처리
	 * (예: 노드 추가/변형/삭제)
	 */
	afterMarkdownParse?: (mdxAst: Root, ctx: HookCtx) => Root | undefined;

	/**
	 * mdast -> ProseMirror 이후: ProseMirror doc 전처리
	 * WARNING: pnpm patch 상에서는 afterProseMirrorParse로 변경했음에도 keystatic에서는 afterParse로 인식되는 문제가 있음.
	 * 추후 afterProseMirrorParse가 필요해질 때 Keystatic이 어떻게 인식하는지 확인할것
	 */
	afterParse?: (doc: unknown, ctx: HookCtx) => unknown | undefined;

	/**
	 * ProseMirror -> mdast 직전: mdast 전처리
	 */
	beforeSerialize?: (mdxAst: Root, ctx: HookCtx) => Root | undefined;

	/**
	 * stringify 이후: mdx 문자열 후처리
	 */
	afterSerialize?: (mdx: string, ctx: HookCtx) => string | undefined;
};

declare global {
	var __KEYSTATIC_EXTRA_PM_PLUGINS__: (schema: Schema) => ExtraPluginsSlots | ExtraPluginsSlots["beforeKeydown"];

	var __KEYSTATIC_MDX_HOOKS__: KSMdxHooks | undefined;
}
