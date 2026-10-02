import { SEOUL_TIME_ZONE } from "@/libs/contents/published-at";
import { DEFAULT_LOCALE, LOCALE_INFO, type Locale } from "./locales";
import { en } from "./messages/en";
import { ja } from "./messages/ja";
import { ko, type MessageKey, type Messages } from "./messages/ko";

const DICTIONARIES: Readonly<Record<Locale, Messages>> = { ko, en, ja };

export type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string;

/**
 * 그 언어의 문구를 돌려주는 함수(v2 B4). 사전에 없는 문구는 기본 언어(한국어) 값을 쓴다.
 * 서버·브라우저 어디서나 쓸 수 있다.
 */
export function translator(locale: Locale): Translate {
	const dictionary = DICTIONARIES[locale] ?? {};
	return (key, params) => {
		const template = dictionary[key] || ko[key];
		if (!params) return template;
		return template.replace(/\{(\w+)\}/g, (match, name: string) =>
			Object.hasOwn(params, name) ? String(params[name]) : match,
		);
	};
}

/** 사전에 아직 없는 키. 번역을 채울 때 확인용이다. */
export function missingMessageKeys(locale: Locale): MessageKey[] {
	if (locale === DEFAULT_LOCALE) return [];
	const dictionary = DICTIONARIES[locale];
	return (Object.keys(ko) as MessageKey[]).filter((key) => !dictionary[key]);
}

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();

/**
 * 표시 날짜. 언어마다 형식이 다르고(`2026년 9월 27일`, `September 27, 2026`, `2026年9月27日`),
 * 시간대는 이 블로그의 기준(서울)으로 고정한다. 실행 환경의 시간대를 쓰면 UTC 런타임에서 날짜가 하루 앞당겨진다.
 */
export function formatDate(value: string, locale: Locale = DEFAULT_LOCALE): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	let formatter = dateFormatters.get(locale);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: SEOUL_TIME_ZONE,
		});
		dateFormatters.set(locale, formatter);
	}
	return formatter.format(date);
}
