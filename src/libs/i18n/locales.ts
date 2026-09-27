/**
 * 콘텐츠 언어 설정(v2 B4). 언어를 더하거나 빼려면 여기만 고친다.
 * 관리자(CMS) 화면은 한국어 그대로이고, 이 목록은 게시글·메모 같은 콘텐츠와 공개 블로그 화면의 언어다.
 */
export const LOCALES = ["ko", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

/** 기본 언어. 주소에 언어 접두사를 붙이지 않는다(`/posts/slug`). */
export const DEFAULT_LOCALE: Locale = "ko";

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** 기본 언어가 아닌 언어. 공개 주소에 `/{locale}` 접두사가 붙는다. */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

interface LocaleInfo {
	/** 그 언어로 쓴 언어 이름(언어 전환 메뉴). */
	readonly nativeName: string;
	/** 관리자 화면에 보이는 한국어 이름. */
	readonly adminName: string;
	/** Open Graph `og:locale`. */
	readonly ogLocale: string;
	/** `Intl` 날짜·숫자 형식에 넘기는 BCP 47 태그. */
	readonly intl: string;
}

export const LOCALE_INFO: Readonly<Record<Locale, LocaleInfo>> = {
	ko: { nativeName: "한국어", adminName: "한국어", ogLocale: "ko_KR", intl: "ko-KR" },
	en: { nativeName: "English", adminName: "영어", ogLocale: "en_US", intl: "en-US" },
	ja: { nativeName: "日本語", adminName: "일본어", ogLocale: "ja_JP", intl: "ja-JP" },
};

/** 공개 주소의 언어 접두사. 기본 언어는 빈 문자열이다. */
export const localePrefix = (locale: Locale): string => (locale === DEFAULT_LOCALE ? "" : `/${locale}`);

/** 기본 언어 기준 경로(`/posts/a`)를 그 언어의 경로로 바꾼다. */
export const localizePath = (locale: Locale, path: string): string => {
	const prefix = localePrefix(locale);
	if (!prefix) return path;
	return path === "/" ? prefix : `${prefix}${path}`;
};

/** 요청 경로의 언어. 접두사가 없으면 기본 언어다. */
export const localeFromPath = (pathname: string): Locale => {
	const first = pathname.split("/")[1];
	return isLocale(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
};
