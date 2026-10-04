import { cmsConfig } from "../config/resolved";
import { type MessageBundle, type MessageVars, translate } from "./define";

export * from "./define";

/**
 * 관리자 화면 언어(BCP 47). 사이트 설정 `admin.locale`, 없으면 사이트 기본 언어(`defaultLocale`). 날짜·숫자 표기도 따른다.
 */
export const ADMIN_LANGUAGE_TAG: string = cmsConfig.admin?.locale ?? cmsConfig.defaultLocale;

/** 사전을 고르는 언어(앞 부분, 예: `ko-KR` → `ko`). */
export const ADMIN_LANGUAGE: string = ADMIN_LANGUAGE_TAG.split("-")[0]?.toLowerCase() ?? "en";

/**
 * 사전 하나의 번역 함수. 관리자 화면 언어로 고르고, 사이트가 `admin.messages`로 덮어쓴 문구를 먼저 쓴다.
 *
 * ```ts
 * const t = createTranslator(messages);
 * t("save"); t("deleted", { name });
 * ```
 */
export function createTranslator<K extends string>(bundle: MessageBundle<K>, language: string = ADMIN_LANGUAGE) {
	return (key: K, vars?: MessageVars): string => translate(bundle, language, key, vars, cmsConfig.admin?.messages);
}
