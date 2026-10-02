import { cmsConfig } from "../config/resolved";
import { isUuid } from "../core/ids";
import type { CollectionSchema } from "./collection";
import { type Field, type SlugField, type StorageType, storageTypeOf, type ValueField } from "./fields";

/**
 * 컬렉션 정의에서 저장·검증·참조 규칙을 만든다(v2 B1). 순수 함수이며 DB·HTTP·React를 모른다.
 * 서버(스냅샷 검증)와 브라우저(속성 패널·폼 변환)가 같은 규칙을 쓴다.
 */

const SCHEMAS = cmsConfig.collections;

export type SchemaCollection = keyof typeof SCHEMAS & string;
/** 관계 대상 컬렉션. 정의의 `to`·`from`은 문자열이고, `defineConfig`가 실제 컬렉션인지 확인했다. */
export type RelationTarget = SchemaCollection;

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
		// 주소는 콘텐츠 열에, 반대 방향 관계는 상대 레코드에 저장한다.
		if (field.kind === "slug" || field.kind === "backlink") continue;
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

/** 관계 필드 목록. v1 `COLLECTION_DEFINITIONS.relations`와 같은 모양이다. */
export function relationsOf(collection: SchemaCollection): { field: string; kind: "entry"; to: RelationTarget }[] {
	return storedFields(collection).flatMap(({ name, field }) =>
		field.kind === "relation" ? [{ field: name, kind: "entry" as const, to: field.to as RelationTarget }] : [],
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
		case "relation":
			return values.every((item) => isUuid(item)) ? null : "invalid_metadata_value";
	}
}

export type MetadataReference = {
	/** 관계 필드는 모두 콘텐츠를 가리킨다. 대상 컬렉션은 필드 정의(`relationRule`)가 정한다. */
	kind: "entry";
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
		const kind = "entry";
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
	return { to: stored.field.to as RelationTarget, allowUnpublished: stored.field.allowUnpublished === true };
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
	options: { localizedOnly?: boolean } = {},
): { code: string; path: string }[] {
	const issues: { code: string; path: string }[] = [];
	// 번역본은 언어별 값만 가지므로 공통 필수값(카테고리 등)은 원문에서 검사한다(v2 B4).
	const required = (field: Field) =>
		"required" in field && field.required === "publish" && (!options.localizedOnly || Boolean(field.localized));
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
		if (field.kind === "backlink") continue;
		if (field.localized === true) own.push(name);
		else if (field.localized === "inherit") inherit.push(name);
	}
	return { own, inherit };
}

/** 번역본이 가지면 안 되는 공통 필드 키(v2 B4). 정의에서 `localized`가 없는 저장 필드다. */
export function commonFieldKeys(collection: SchemaCollection, metadata: { readonly [key: string]: unknown }): string[] {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	return Object.keys(metadata).filter((key) => !localized.has(key));
}

/** 원문 메타데이터에서 번역본으로 옮길 언어별 값만 고른다. */
export function pickLocalizedMetadata<T>(
	collection: SchemaCollection,
	metadata: { readonly [key: string]: T },
): Record<string, T> {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	return Object.fromEntries(Object.entries(metadata).filter(([key]) => localized.has(key)));
}

/** 번역본 공개 메타데이터 = 원문의 공통 값 + 번역본의 언어별 값. */
export function mergeTranslationMetadata<T>(
	collection: SchemaCollection,
	source: { readonly [key: string]: T },
	translation: { readonly [key: string]: T },
): Record<string, T> {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	const common = Object.fromEntries(Object.entries(source).filter(([key]) => !localized.has(key)));
	return { ...common, ...translation };
}

/**
 * record 컬렉션(카테고리·태그·모음집)의 언어별 값을 담는 메타데이터 키(v2 B4).
 * `{ en: { title: "..." }, ja: { ... } }`. 주소와 연결 관계는 공통이라 레코드는 언어마다 나누지 않는다.
 */
export const RECORD_TRANSLATIONS_KEY = "translations";

export type RecordTranslations = { readonly [locale: string]: { readonly [field: string]: string } };

/** 언어별 값을 가질 수 있는 record 컬렉션의 텍스트 필드. */
export function recordLocalizedFields(collection: SchemaCollection): string[] {
	const schema = schemaOf(collection);
	if (schema.workflow !== "record") return [];
	return Object.entries(schema.fields)
		.filter(([, field]) => field.kind === "text" && field.localized === true)
		.map(([name]) => name);
}

/**
 * record 언어별 값을 검사하고 정리한다. 기본 언어가 아닌 언어와 정의의 언어별 텍스트 필드만 받는다.
 * 빈 값과 빈 언어는 지운다. 잘못된 모양이면 v1 오류 코드를 던질 수 있게 `error`를 돌려준다.
 */
export function normalizeRecordTranslations(
	collection: SchemaCollection,
	value: unknown,
	locales: readonly string[],
): { value: RecordTranslations } | { error: string } {
	const fieldsAllowed = recordLocalizedFields(collection);
	const isPlain = (item: unknown): item is Record<string, unknown> =>
		typeof item === "object" &&
		item !== null &&
		!Array.isArray(item) &&
		(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null);
	if (fieldsAllowed.length === 0) return { error: "invalid_metadata_key" };
	if (!isPlain(value)) return { error: "invalid_metadata_type" };
	const result: Record<string, Record<string, string>> = {};
	for (const [locale, values] of Object.entries(value)) {
		if (!locales.includes(locale)) return { error: "invalid_metadata_value" };
		if (!isPlain(values)) return { error: "invalid_metadata_type" };
		const cleaned: Record<string, string> = {};
		for (const [name, text] of Object.entries(values)) {
			const field = storedField(collection, name)?.field;
			if (!fieldsAllowed.includes(name) || field?.kind !== "text") return { error: "invalid_metadata_key" };
			if (typeof text !== "string") return { error: "invalid_metadata_type" };
			const error = fieldValueError(field, name, text);
			if (error) return { error };
			if (text.trim()) cleaned[name] = text.trim();
		}
		if (Object.keys(cleaned).length > 0) result[locale] = cleaned;
	}
	return { value: result };
}
