import { CMS_TIME_ZONE } from "@bh2980/cms/client";

/** 관리자 화면의 날짜·시각 표시. 글은 한국어이고 시간대는 사이트 설정(`timeZone`)을 따른다. */
export const formatDateTime = (value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
	new Date(value).toLocaleString("ko-KR", { timeZone: CMS_TIME_ZONE, ...options });

/** 날짜만(`2025. 8. 7.`). */
export const formatDateOnly = (value: string | number | Date) =>
	new Date(value).toLocaleDateString("ko-KR", { timeZone: CMS_TIME_ZONE });

/** 설정 시간대에서의 연도. */
export const zonedYear = (value: string | number | Date) =>
	Number(new Date(value).toLocaleString("en-US", { timeZone: CMS_TIME_ZONE, year: "numeric" }));
