import { isUuid } from "../core/ids";
import type { CollectionSchema } from "./collection";
import { SCHEMAS } from "./definitions";
import {
	type Field,
	type RelationTarget,
	type SlugField,
	type StorageType,
	storageTypeOf,
	type ValueField,
} from "./fields";

/**
 * 컬렉션 정의에서 저장·검증·참조 규칙을 만든다(v2 B1). 순수 함수이며 DB·HTTP·React를 모른다.
 * 서버(스냅샷 검증)와 브라우저(속성 패널·폼 변환)가 같은 규칙을 쓴다.
 */

export type SchemaCollection = keyof typeof SCHEMAS;
export type ReferenceKindOf = "category" | "tag" | "entry";

export const schemaOf = (collection: SchemaCollection): CollectionSchema => SCHEMAS[collection];

/** 메타데이터에 값 하나로 저장되는 필드. 조건부 필드의 선택 값과 딸린 필드도 각각 하나로 펼친다. */
export interface StoredField {
	readonly name: string;
	readonly field: ValueField;
	/** 조건부 필드에 딸린 필드면 그 조건. 조건이 맞을 때만 값을 남긴다. */
	readonly when?: { readonly field: string; readonly value: string };
}

const storedCache = new Map<SchemaCollection, readonly StoredField[]>();

/** 저장 필드 목록. 선언 순서를 따르고 조건부 필드에 딸린 필드는 그 필드 바로 뒤에 온다. */
export function storedFields(collection: SchemaCollection): readonly StoredField[] {
	const cached = storedCache.get(collection);
	if (cached) return cached;
	const result: StoredField[] = [];
	for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
		if (field.kind === "slug") continue;
		if (field.kind === "conditional") {
			result.push({ name, field: field.discriminant });
			for (const [value, group] of Object.entries(field.values)) {
				for (const [nestedName, nested] of Object.entries(group ?? {})) {
					result.push({ name: nestedName, field: nested, when: { field: name, value } });
				}
			}
			continue;
		}
		result.push({ name, field });
	}
	storedCache.set(collection, Object.freeze(result));
	return result;
}

export function storedField(collection: SchemaCollection, name: string): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.name === name);
}

export function slugFieldOf(collection: SchemaCollection): SlugField | undefined {
	return Object.values(schemaOf(collection).fields).find((field): field is SlugField => field.kind === "slug");
}

/** 필드 이름 → 저장 형식. v1 `COLLECTION_DEFINITIONS.fields`와 같은 모양이다. */
export function storageTypes(collection: SchemaCollection): Record<string, StorageType> {
	return Object.fromEntries(storedFields(collection).map(({ name, field }) => [name, storageTypeOf(field)]));
}

export const referenceKindOf = (to: RelationTarget): ReferenceKindOf =>
	to === "category" ? "category" : to === "tag" ? "tag" : "entry";

/** 관계 필드 목록. v1 `COLLECTION_DEFINITIONS.relations`와 같은 모양이다. */
export function relationsOf(
	collection: SchemaCollection,
): { field: string; kind: ReferenceKindOf; to: RelationTarget }[] {
	return storedFields(collection).flatMap(({ name, field }) =>
		field.kind === "relation" ? [{ field: name, kind: referenceKindOf(field.to), to: field.to }] : [],
	);
}

/**
 * 저장 형식 검사를 통과한 값의 의미를 검사한다. 문제가 있으면 v1 API의 오류 코드를 돌려준다.
 */
export function fieldValueError(field: ValueField, name: string, value: string | readonly string[]): string | null {
	const values = typeof value === "string" ? [value] : value;
	switch (field.kind) {
		case "text":
			if (field.max !== undefined && values.some((item) => Array.from(item).length > (field.max ?? 0))) {
				return name === "title" ? "title_too_long" : "field_too_long";
			}
			return null;
		case "select":
			return values.every((item) => Object.hasOwn(field.options, item)) ? null : "invalid_metadata_value";
		case "datetime":
			return values.every((item) => !Number.isNaN(Date.parse(item))) ? null : "invalid_metadata_value";
		case "relation":
			return values.every((item) => isUuid(item)) ? null : "invalid_metadata_value";
	}
}

export type MetadataReference = {
	kind: ReferenceKindOf;
	targetId: string;
	path: string;
	ordinal?: number;
};

/**
 * 메타데이터 관계 필드의 참조를 선언 순서대로 모은다. 여러 개인 필드는 순서와 중복을 보존한다.
 * 조건이 맞지 않는 딸린 필드도 값이 있으면 모은다(저장된 값은 모두 추적한다).
 */
export function metadataReferences(
	collection: SchemaCollection,
	metadata: { readonly [key: string]: unknown },
): MetadataReference[] {
	const references: MetadataReference[] = [];
	for (const { name, field } of storedFields(collection)) {
		if (field.kind !== "relation") continue;
		const kind = referenceKindOf(field.to);
		const value = metadata[name];
		if (typeof value === "string") references.push({ kind, targetId: value, path: name });
		else if (Array.isArray(value)) {
			value.forEach((id, ordinal) => {
				if (typeof id === "string") references.push({ kind, targetId: id, path: name, ordinal });
			});
		}
	}
	return references;
}

/** 관계 필드가 기대하는 대상 컬렉션과 미공개 대상 허용 여부. */
export function relationRule(
	collection: SchemaCollection,
	path: string,
): { to: RelationTarget; allowUnpublished: boolean } | undefined {
	const stored = storedField(collection, path);
	if (stored?.field.kind !== "relation") return undefined;
	return { to: stored.field.to, allowUnpublished: stored.field.allowUnpublished === true };
}

/** v1 API가 쓰던 필수값 문제 코드. 새 필드는 `missing_field`를 쓴다. */
const LEGACY_REQUIRED_CODES: Readonly<Record<string, string>> = {
	slug: "null_slug",
	title: "missing_title",
	categoryId: "missing_category",
};

const isEmptyValue = (value: unknown) =>
	value === undefined ||
	value === null ||
	(typeof value === "string" && value === "") ||
	(Array.isArray(value) && value.length === 0);

/** 발행(record는 저장) 때 비어 있으면 안 되는 필드의 문제. */
export function missingRequiredIssues(
	collection: SchemaCollection,
	snapshot: { slug: string | null; metadata: { readonly [key: string]: unknown } },
): { code: string; path: string }[] {
	const issues: { code: string; path: string }[] = [];
	const required = (field: Field) => "required" in field && field.required === "publish";
	for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
		if (field.kind !== "slug" || !required(field)) continue;
		if (!snapshot.slug) issues.push({ code: LEGACY_REQUIRED_CODES.slug ?? "missing_field", path: name });
	}
	for (const { name, field, when } of storedFields(collection)) {
		if (!required(field)) continue;
		if (when && snapshot.metadata[when.field] !== when.value) continue;
		if (isEmptyValue(snapshot.metadata[name])) {
			issues.push({ code: LEGACY_REQUIRED_CODES[name] ?? "missing_field", path: name });
		}
	}
	return issues;
}

/** 언어별 값인 필드 이름(v2 B4). 표시가 없는 필드는 번역 묶음이 공통으로 쓴다. */
export function localizedFieldNames(collection: SchemaCollection): { own: string[]; inherit: string[] } {
	const own: string[] = [];
	const inherit: string[] = [];
	for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
		if (field.localized === true) own.push(name);
		else if (field.localized === "inherit") inherit.push(name);
	}
	return { own, inherit };
}
