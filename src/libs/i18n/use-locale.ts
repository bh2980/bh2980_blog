"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { type Locale, localeFromPath } from "./locales";
import { type Translate, translator } from "./translate";

/** 지금 보고 있는 공개 화면의 언어(주소의 `/en`·`/ja` 접두사, v2 B4). */
export function useLocale(): Locale {
	return localeFromPath(usePathname() ?? "/");
}

/** 지금 언어의 문구 함수. */
export function useTranslate(): { locale: Locale; t: Translate } {
	const locale = useLocale();
	return useMemo(() => ({ locale, t: translator(locale) }), [locale]);
}
