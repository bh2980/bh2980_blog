/**
 * 저작 API. 사이트 설정 파일(`cms.config.ts`)이 import하는 진입점이다.
 *
 * 여기서 내보내는 모듈은 사이트 설정(`config/resolved.ts`)을 import하면 안 된다. 설정 파일이 이 진입점을 import하므로
 * 순환이 생겨 설정이 반쯤 만들어진 채로 읽힌다.
 */

export type { BlockAttribute, BlockChildren, BlockDefinition, BlockEditor, BlockSyntax } from "./blocks/define";
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
	type Field,
	type FieldKind,
	fields,
	type Localized,
	type RelationField,
	type SelectField,
	type SlugField,
	type TextField,
	type ValueField,
} from "./schema/fields";
