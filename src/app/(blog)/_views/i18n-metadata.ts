import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALE_INFO, LOCALES, type Locale, localizePath } from "@/libs/i18n/locales";

/**
 * 언어별 주소의 `hreflang` 연결(v2 B4). 기본 언어 주소를 `x-default`로 둔다.
 * `paths`에 없는 언어는 넣지 않는다(번역이 공개되지 않은 언어는 연결하지 않는다).
 */
export function languageAlternates(paths: readonly { locale: Locale; path: string }[]): Record<string, string> {
	const languages: Record<string, string> = {};
	for (const locale of LOCALES) {
		const found = paths.find((item) => item.locale === locale);
		if (found) languages[locale] = found.path;
	}
	const fallback = paths.find((item) => item.locale === DEFAULT_LOCALE);
	if (fallback) languages["x-default"] = fallback.path;
	return languages;
}

/** 모든 언어에 있는 화면(첫 화면·목록). 정규 주소는 이 언어의 주소다. */
export function sectionAlternates(locale: Locale, path: string): Metadata["alternates"] {
	return {
		canonical: localizePath(locale, path),
		languages: languageAlternates(LOCALES.map((item) => ({ locale: item, path: localizePath(item, path) }))),
		types: { "application/rss+xml": localizePath(locale, "/rss.xml") },
	};
}

/** Open Graph 언어. 다른 공개 언어는 `alternateLocale`로 알린다. */
export function openGraphLocale(locale: Locale, available: readonly Locale[] = LOCALES) {
	return {
		locale: LOCALE_INFO[locale].ogLocale,
		alternateLocale: available.filter((item) => item !== locale).map((item) => LOCALE_INFO[item].ogLocale),
	};
}
