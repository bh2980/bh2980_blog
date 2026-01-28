import type { Root } from "mdast";
import type { Schema } from "prosemirror-model";
import type { ExtraPluginsSlots } from "@/keystatic/plugins";

type HookCtx = { slug?: string };

declare global {
	var __KEYSTATIC_EXTRA_PM_PLUGINS__: (schema: Schema) => ExtraPluginsSlots | ExtraPluginsSlots["beforeKeydown"];
	var __KEYSTATIC_MDX_HOOKS__:
		| {
				beforeParse?: (mdx: string, ctx: HookCtx) => string | undefined;
				afterParse?: (doc: unknown, ctx: HookCtx) => unknown | undefined;
				beforeSerialize?: (mdxAst: Root, ctx: HookCtx) => unknown | undefined;
				afterSerialize?: (mdx: string, ctx: HookCtx) => string | undefined;
		  }
		| undefined;
}
