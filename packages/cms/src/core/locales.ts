import { cmsConfig } from "../config/resolved";

/** 콘텐츠 언어(`cms.config.ts`의 `locales`). 관리자 화면 자체의 언어와는 별개다. */
export const LOCALES = cmsConfig.locales.map((locale) => locale.code);
export type Locale = (typeof cmsConfig.locales)[number]["code"];

/** 기본 언어. 주소에 언어 접두사를 붙이지 않는다. */
export const DEFAULT_LOCALE: Locale = cmsConfig.defaultLocale;

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** 기본 언어가 아닌 언어. 공개 주소에 `/{locale}` 접두사가 붙는다. */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/** 그 언어로 쓴 언어 이름. 모르는 코드는 그대로 돌려준다. */
export const localeName = (code: string): string =>
	cmsConfig.locales.find((locale) => locale.code === code)?.name ?? code;

/** 관리자 화면의 언어 이름. 모르는 코드는 그대로 돌려준다. */
export const localeLabel = (code: string): string => {
	const locale = cmsConfig.locales.find((entry) => entry.code === code);
	return locale ? (locale.label ?? locale.name) : code;
};
