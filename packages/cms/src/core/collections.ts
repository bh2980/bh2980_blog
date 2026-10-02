import { cmsConfig } from "../config/resolved";
import type { CollectionWorkflow } from "../schema/collection";
import { relationsOf, type SchemaCollection, schemaOf, storageTypes } from "../schema/derive";
import type { StorageType } from "../schema/fields";

/** 컬렉션 이름(`cms.config.ts`의 `collections` 키). 선언 순서를 따른다. */
export type Collection = SchemaCollection;
export const COLLECTIONS = Object.keys(cmsConfig.collections) as readonly Collection[];

export type { CollectionWorkflow } from "../schema/collection";

export type FieldType = StorageType;

export interface CollectionRelation {
	readonly field: string;
	readonly kind: "entry";
}

/** v1 모양의 컬렉션 요약. 필드·관계는 사이트 설정(`cms.config.ts`)의 정의에서 만든다(v2 B1). */
export interface CollectionDefinition {
	readonly name: Collection;
	readonly label: string;
	readonly workflow: CollectionWorkflow;
	readonly fields: Readonly<Record<string, FieldType>>;
	readonly relations?: readonly CollectionRelation[];
}

export const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>> = Object.fromEntries(
	COLLECTIONS.map((name) => {
		const schema = schemaOf(name);
		const relations = relationsOf(name).map(({ field, kind }) => ({ field, kind }));
		return [
			name,
			{
				name,
				label: schema.label,
				workflow: schema.workflow,
				fields: storageTypes(name),
				...(relations.length > 0 ? { relations } : {}),
			},
		];
	}),
) as Record<Collection, CollectionDefinition>;

export function isCollection(val: unknown): val is Collection {
	return typeof val === "string" && (COLLECTIONS as readonly string[]).includes(val);
}

/** 명시적 저장이 곧 공개 반영인 분류용 컬렉션인가(§5.2 record workflow). */
export function isRecordCollection(val: unknown): boolean {
	return isCollection(val) && COLLECTION_DEFINITIONS[val].workflow === "record";
}

/** 본문을 쓰고 초안/발행을 나누는 콘텐츠 컬렉션. */
export const CONTENT_COLLECTIONS = COLLECTIONS.filter((c) => COLLECTION_DEFINITIONS[c].workflow === "publish");
