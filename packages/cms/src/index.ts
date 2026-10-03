/**
 * 저작 API. 사이트 설정 파일(`cms.config.ts`)이 import하는 진입점이다.
 *
 * 여기서 내보내는 모듈은 사이트 설정(`config/resolved.ts`)을 import하면 안 된다. 설정 파일이 이 진입점을 import하므로
 * 순환이 생겨 설정이 반쯤 만들어진 채로 읽힌다.
 */

export {
	type CodeBlockConfig,
	type CodeLineEffectDefinition,
	type CodeLineEffectEditor,
	DEFAULT_CODE_LINE_EFFECTS,
} from "./annotation/code-block/line-effects";
export type {
	BlockAttribute,
	BlockChildren,
	BlockDefinition,
	BlockEditor,
	BlockInsert,
	BlockSyntax,
} from "./blocks/define";
export { defineBlock } from "./blocks/define";
export {
	type CmsConfig,
	type CollectionsConfig,
	defineConfig,
	type LocaleConfig,
	type SeedConfig,
	type SeedTemplate,
	type SiteConfig,
} from "./config/define";
export { type ColorPair, DEFAULT_TEXT_PALETTE, type PaletteColor } from "./core/text-colors";
export {
	type CmsPlugin,
	type CmsServerPlugin,
	definePlugin,
	type PluginConfigView,
	type PluginDatabase,
	type PluginNamed,
	type PluginNavItem,
	type PluginRoute,
} from "./plugin/define";
export {
	type CollectionSchema,
	type CollectionWorkflow,
	defineCollection,
	type LayoutGroup,
	type MetadataOf,
	SYSTEM_LIST_COLUMNS,
	type SystemListColumn,
} from "./schema/collection";
export {
	type BacklinkField,
	type ConditionalField,
	FIELD_ROLES,
	type Field,
	type FieldKind,
	type FieldRole,
	fields,
	type Localized,
	type RelationField,
	type SelectField,
	type SelectFieldRole,
	type SlugField,
	type TextField,
	type TextFieldRole,
	type ValueField,
} from "./schema/fields";
