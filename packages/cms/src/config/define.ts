import { type CodeBlockConfig, validateCodeBlockConfig } from "../annotation/code-block/line-effects";
import type { BlockDefinition } from "../blocks/define";
import { resolveBlocks } from "../blocks/resolve";
import { type PaletteColor, validateTextPalette } from "../core/text-colors";
import type { CmsPlugin } from "../plugin/define";
import type { CollectionSchema } from "../schema/collection";
import { FIELD_ROLES, type Field, TEXT_FIELD_ROLES, type ValueField } from "../schema/fields";

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

export interface SiteConfig {
	/**
	 * 공개 사이트 주소(예: `https://example.com`). 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다.
	 * 환경마다 다르면 환경 변수에서 읽는다. 없으면 `/posts/...`처럼 경로로 적은 링크만 알아본다.
	 */
	readonly url?: string;
	/** 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). */
	readonly aliases?: readonly string[];
	/** 관리자 화면에 보이는 사이트 이름(사이드바·검색 미리보기·창 제목). 없으면 `url`의 호스트 이름. */
	readonly name?: string;
	/**
	 * 초안 미리보기 주소 앞부분(예: `/preview`). 편집 화면의 `미리보기`가 이 뒤에 공개 경로(컬렉션 `path`)를 붙여 연다.
	 * 기본 언어가 아니면 `?locale=`을 붙인다. 없으면 미리보기 단추가 없다.
	 */
	readonly previewPath?: string;
}

export interface SeedTemplate {
	/** 고정 ID(UUID). 마이그레이션을 여러 번 돌려도 같은 템플릿이 하나만 생긴다. */
	readonly id: string;
	readonly name: string;
	readonly mdx: string;
}

export interface SeedConfig {
	/**
	 * 새 저장소의 첫 마이그레이션 때 한 번만 넣는 본문 템플릿. 이미 넣은 저장소에는 나중에 더한 템플릿도 넣지 않고,
	 * 지운 템플릿을 되살리지 않는다.
	 */
	readonly templates?: readonly SeedTemplate[];
}

export interface CmsConfig<
	Collections extends CollectionsConfig = CollectionsConfig,
	Locale extends string = string,
	Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[],
> {
	/** 컬렉션 이름 → 정의. 이름은 저장 값(`entries.collection`)이므로 운영 중에 바꾸지 않는다. */
	readonly collections: Collections;
	/** 콘텐츠 언어. 선언 순서가 화면에 보이는 순서다. */
	readonly locales: readonly LocaleConfig<Locale>[];
	/** 기본 언어. 공개 주소에 언어 접두사를 붙이지 않는다. */
	readonly defaultLocale: NoInfer<Locale>;
	readonly site?: SiteConfig;
	/**
	 * 날짜·시각을 입력하고 보이는 시간대(IANA, 예: `Asia/Seoul`). 발행일·예약 시각 입력이 이 시간대의 벽시계다.
	 * 없으면 `UTC`.
	 */
	readonly timeZone?: string;
	/** 새 저장소에 처음 넣을 데이터. */
	readonly seed?: SeedConfig;
	/**
	 * 사이트가 더하는 본문 블록(`defineBlock`). 콜아웃·탭 같은 블록은 블록 확장(`@bh2980/cms-blocks`)을 `plugins`에
	 * 넣어 더한다. 공개 화면은 사이트가 `component` 이름으로 그린다.
	 */
	readonly blocks?: readonly BlockDefinition[];
	/** 플러그인(예: `aiPlugin()`). 이름은 겹치지 않아야 한다. */
	readonly plugins?: Plugins;
	/** 코드 블록 설정. 줄 효과(`lineEffects`)를 더하거나 본체 기본(강조·추가·삭제·경고·오류)을 바꾼다. */
	readonly codeBlock?: CodeBlockConfig;
	/** 편집기 글자색·배경색 고르기 목록. 없으면 본체 기본 프리셋(`DEFAULT_TEXT_PALETTE`)이다. */
	readonly textColors?: readonly PaletteColor[];
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

const isTextRole = (role: string): boolean => (TEXT_FIELD_ROLES as readonly string[]).includes(role);

/** 필드 역할(`role`)·본문에서 채우기(`fillFromBody`)·주소 원본(`from`)이 필드 종류와 맞는지 확인한다. */
function validateFieldMeanings(collection: string, schema: CollectionSchema): void {
	const roles = new Map<string, string>();
	for (const [name, field] of valueFields(schema.fields)) {
		const role = "role" in field ? field.role : undefined;
		if (role !== undefined) {
			if (!(FIELD_ROLES as readonly string[]).includes(role)) {
				throw new Error(`cms.config: ${collection}.${name} has unknown role "${role}"`);
			}
			const fits =
				role === "noindex"
					? field.kind === "select" && Object.hasOwn(field.options, "noindex")
					: field.kind === "text" && isTextRole(role);
			if (!fits) {
				throw new Error(
					role === "noindex"
						? `cms.config: ${collection}.${name} role "noindex" needs a select field with a "noindex" option`
						: `cms.config: ${collection}.${name} role "${role}" needs a text field`,
				);
			}
			const other = roles.get(role);
			if (other) throw new Error(`cms.config: ${collection} has role "${role}" on both ${other} and ${name}`);
			roles.set(role, name);
		}
		if (field.kind === "text" && field.fillFromBody && !schema.body) {
			throw new Error(`cms.config: ${collection}.${name} fillFromBody needs a collection with a body`);
		}
	}
	for (const [index, group] of (schema.layout ?? []).entries()) {
		const at = `cms.config: ${collection}.layout[${index}]`;
		if (group.tab !== undefined && (!group.tab.trim() || group.tab.length > 20)) {
			throw new Error(`${at}.tab must be 1-20 characters`);
		}
		if (group.preview !== undefined && !/^[a-z][a-z0-9-]*$/.test(group.preview)) {
			throw new Error(`${at}.preview must be a kebab-case name`);
		}
	}
	for (const [name, field] of Object.entries(schema.fields)) {
		if (field.kind !== "slug" || field.from === undefined) continue;
		if (schema.fields[field.from]?.kind !== "text") {
			throw new Error(`cms.config: ${collection}.${name} is made from "${field.from}", which is not a text field`);
		}
	}
}

/** 설정이 서로 맞는지 확인한다. 틀리면 앱이 뜰 때 바로 알린다. */
function validate(config: CmsConfig<CollectionsConfig, string, readonly CmsPlugin[]>): void {
	const names = Object.keys(config.collections);
	if (names.length === 0) throw new Error("cms.config: `collections` is empty");

	const codes = config.locales.map((locale) => locale.code);
	if (codes.length === 0) throw new Error("cms.config: `locales` is empty");
	if (new Set(codes).size !== codes.length) throw new Error("cms.config: `locales` has duplicate codes");
	if (!codes.includes(config.defaultLocale)) {
		throw new Error(`cms.config: defaultLocale "${config.defaultLocale}" is not in \`locales\``);
	}

	if (config.site?.url !== undefined) {
		let url: URL | undefined;
		try {
			url = new URL(config.site.url);
		} catch {}
		if (url?.protocol !== "http:" && url?.protocol !== "https:") {
			throw new Error(`cms.config: site.url "${config.site.url}" is not an http(s) URL`);
		}
	}

	if (config.timeZone !== undefined) {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone });
		} catch {
			throw new Error(`cms.config: timeZone "${config.timeZone}" is not an IANA time zone`);
		}
	}

	const templateIds = new Set<string>();
	for (const template of config.seed?.templates ?? []) {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id)) {
			throw new Error(`cms.config: seed template "${template.name}" needs a UUID id`);
		}
		if (templateIds.has(template.id.toLowerCase())) {
			throw new Error(`cms.config: seed template id "${template.id}" is duplicated`);
		}
		templateIds.add(template.id.toLowerCase());
	}

	const paths = new Map<string, string>();
	for (const [collection, schema] of Object.entries(config.collections)) {
		// 목록·검색·관계 고르기·본문 링크·편집 화면 제목 칸이 `title`을 쓴다.
		if (schema.fields.title?.kind !== "text") {
			throw new Error(`cms.config: ${collection} needs a "title" text field (fields.text)`);
		}
		validateFieldMeanings(collection, schema);
		if (schema.path !== undefined) {
			const { path } = schema;
			if (!path.startsWith("/") || path.split(":slug").length !== 2 || /:(?!slug)/.test(path) || /[?#]/.test(path)) {
				throw new Error(`cms.config: ${collection}.path "${path}" must start with "/" and contain ":slug" once`);
			}
			if (!Object.values(schema.fields).some((field) => field.kind === "slug")) {
				throw new Error(`cms.config: ${collection}.path needs a slug field`);
			}
			const other = paths.get(path);
			if (other) throw new Error(`cms.config: ${collection}.path is the same as ${other}.path`);
			paths.set(path, collection);
		}
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

	const blocks = resolveBlocks(config).map((block) => block.name);
	validateCodeBlockConfig(config.codeBlock);
	validateTextPalette(config.textColors);

	const plugins = config.plugins ?? [];
	const pluginNames = plugins.map((plugin) => plugin.name);
	if (new Set(pluginNames).size !== pluginNames.length) throw new Error("cms.config: `plugins` has duplicate names");
	for (const plugin of plugins) plugin.validate?.({ collections: config.collections, locales: config.locales, blocks });
}

/** 사이트 설정을 정의한다. 컬렉션·언어 이름을 타입으로 보존하고, 서로 맞지 않는 설정은 바로 알린다. */
export function defineConfig<
	const Collections extends CollectionsConfig,
	const Locale extends string,
	const Plugins extends readonly CmsPlugin[] = readonly [],
>(config: CmsConfig<Collections, Locale, Plugins>): CmsConfig<Collections, Locale, Plugins> {
	validate(config);
	return config;
}
