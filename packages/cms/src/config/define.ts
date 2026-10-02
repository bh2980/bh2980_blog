import type { CollectionSchema } from "../schema/collection";
import type { Field, ValueField } from "../schema/fields";

/**
 * 사이트 설정(`cms.config.ts`) 규격. 블로그마다 컬렉션·언어를 여기에 적고 `defineConfig`로 감싸 기본 내보내기로 둔다.
 *
 * 설정은 서버와 관리자 화면(브라우저)이 함께 읽으므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 비밀 값(DB 주소·API 키)은 넣지 않고 환경 변수로 둔다.
 */

export interface LocaleConfig<Code extends string = string> {
	/** 언어 코드(BCP 47 앞부분, 예: `ko`). 저장 값과 공개 주소 접두사에 쓴다. */
	readonly code: Code;
	/** 그 언어로 쓴 언어 이름(예: `English`). AI 번역 지시문에 들어간다. */
	readonly name: string;
	/** 관리자 화면에 보이는 이름. 없으면 `name`을 쓴다. */
	readonly label?: string;
}

export type CollectionsConfig = Readonly<Record<string, CollectionSchema>>;

export interface CmsConfig<Collections extends CollectionsConfig = CollectionsConfig, Locale extends string = string> {
	/** 컬렉션 이름 → 정의. 이름은 저장 값(`entries.collection`)이므로 운영 중에 바꾸지 않는다. */
	readonly collections: Collections;
	/** 콘텐츠 언어. 선언 순서가 화면에 보이는 순서다. */
	readonly locales: readonly LocaleConfig<Locale>[];
	/** 기본 언어. 공개 주소에 언어 접두사를 붙이지 않는다. */
	readonly defaultLocale: NoInfer<Locale>;
}

/** 값 하나를 저장하는 필드. 조건부 필드의 선택 값과 딸린 필드도 펼친다. */
function* valueFields(fields: Readonly<Record<string, Field>>): Generator<[string, ValueField]> {
	for (const [name, field] of Object.entries(fields)) {
		if (field.kind === "slug" || field.kind === "backlink") continue;
		if (field.kind === "conditional") {
			yield [name, field.discriminant];
			for (const group of Object.values(field.values)) yield* Object.entries(group ?? {});
			continue;
		}
		yield [name, field];
	}
}

/** 설정이 서로 맞는지 확인한다. 틀리면 앱이 뜰 때 바로 알린다. */
function validate(config: CmsConfig): void {
	const names = Object.keys(config.collections);
	if (names.length === 0) throw new Error("cms.config: `collections` is empty");

	const codes = config.locales.map((locale) => locale.code);
	if (codes.length === 0) throw new Error("cms.config: `locales` is empty");
	if (new Set(codes).size !== codes.length) throw new Error("cms.config: `locales` has duplicate codes");
	if (!codes.includes(config.defaultLocale)) {
		throw new Error(`cms.config: defaultLocale "${config.defaultLocale}" is not in \`locales\``);
	}

	for (const [collection, schema] of Object.entries(config.collections)) {
		for (const [name, field] of valueFields(schema.fields)) {
			if (field.kind === "relation" && !Object.hasOwn(config.collections, field.to)) {
				throw new Error(`cms.config: ${collection}.${name} relates to unknown collection "${field.to}"`);
			}
		}
		for (const [name, field] of Object.entries(schema.fields)) {
			if (field.kind !== "backlink") continue;
			const source = config.collections[field.from];
			if (!source) throw new Error(`cms.config: ${collection}.${name} links from unknown collection "${field.from}"`);
			const via = [...valueFields(source.fields)].find(([fieldName]) => fieldName === field.via)?.[1];
			if (via?.kind !== "relation" || !via.many || via.to !== collection) {
				throw new Error(
					`cms.config: ${collection}.${name} needs ${field.from}.${field.via} to be a many relation to "${collection}"`,
				);
			}
		}
	}
}

/** 사이트 설정을 정의한다. 컬렉션·언어 이름을 타입으로 보존하고, 서로 맞지 않는 설정은 바로 알린다. */
export function defineConfig<const Collections extends CollectionsConfig, const Locale extends string>(
	config: CmsConfig<Collections, Locale>,
): CmsConfig<Collections, Locale> {
	validate(config);
	return config;
}
