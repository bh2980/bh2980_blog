/**
 * 발행일 문자열의 KST 해석과 표시 규칙.
 *
 * Keystatic은 `datetime` 필드를 **KST 벽시계 시각을 UTC로 잘못 표시한 `Z` 문자열**로
 * 저장한다(예: 실제 2026-02-13 00:21 KST → `2026-02-13T00:21:00Z`). 이 값을 그대로
 * `Date`로 읽으면 순간이 9시간 어긋난다.
 *
 * 그래서 오프셋을 떼고 `+09:00`을 붙여 **원래 벽시계 시각을 KST 순간으로** 되돌린다.
 * 이관(`import-plan`)과 파일 기반 조회(`keystatic` 저장소)가 같은 값을 쓰도록 공유한다.
 */

/** 이 블로그의 표시 기준 시간대. */
export const SEOUL_TIME_ZONE = "Asia/Seoul";

const SEOUL_OFFSET = "+09:00";
const SEOUL_OFFSET_HOURS = 9;

/** UTC 순간을 `datetime-local`에서 쓰는 서울 벽시계 문자열로 바꾼다. */
export function formatSeoulDateTimeInput(value: string | number | Date | null | undefined): string {
	if (value === null || value === undefined || value === "") return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: SEOUL_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** 서울 벽시계 입력을 UTC ISO 순간으로 바꾼다. */
export function parseSeoulDateTimeInput(value: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const [, yearText, monthText, dayText, hourText, minuteText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const localAsUtc = new Date(0);
	localAsUtc.setUTCFullYear(year, month - 1, day);
	localAsUtc.setUTCHours(hour, minute, 0, 0);
	if (
		localAsUtc.getUTCFullYear() !== year ||
		localAsUtc.getUTCMonth() !== month - 1 ||
		localAsUtc.getUTCDate() !== day ||
		localAsUtc.getUTCHours() !== hour ||
		localAsUtc.getUTCMinutes() !== minute
	) {
		return null;
	}
	return new Date(localAsUtc.getTime() - SEOUL_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
}

/** `Z`/오프셋이 붙은 문자열을 KST 벽시계로 해석한 ISO 문자열로 바꾼다. */
export function keystaticPublishedAt(value: string | null): string | null {
	if (!value) return null;
	const wallClock = value.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
	if (!wallClock) return value;

	const withSeoul = `${wallClock}${SEOUL_OFFSET}`;
	return Number.isNaN(Date.parse(withSeoul)) ? value : withSeoul;
}
