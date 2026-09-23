import { SEOUL_TIME_ZONE } from "@/libs/contents/published-at";

// 표시 날짜는 이 블로그의 기준 시간대(KST)로 고정한다. `timeZone`을 비우면 실행 환경의
// 로컬 시간대를 쓰므로, UTC 런타임(예: Vercel)에서 KST 벽시계 00:00~08:59 발행분이
// 하루 앞당겨 보인다.
const publishedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
	year: "numeric",
	month: "long",
	day: "numeric",
	timeZone: SEOUL_TIME_ZONE,
});

/** 검수용: 포맷터가 실제로 KST에 고정됐는지 확인할 수 있게 노출한다. */
export { publishedAtFormatter };

export function formatPublishedAt(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return publishedAtFormatter.format(date);
}
