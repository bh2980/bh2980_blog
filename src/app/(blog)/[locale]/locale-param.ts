import { notFound } from "next/navigation";
import { type Locale, PREFIXED_LOCALES } from "@/libs/i18n/locales";

/**
 * 언어 접두사 주소(`/en/...`, `/ja/...`)의 언어(v2 B4). 설정에 없는 값이나 기본 언어(`/ko/...`)는 404다.
 * 기본 언어는 접두사 없는 기존 주소만 쓴다.
 */
export function prefixedLocale(value: string): Locale {
	const locale = (PREFIXED_LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
	if (!locale) notFound();
	return locale;
}

export type LocaleParams<T = object> = { params: Promise<{ locale: string } & T> };
