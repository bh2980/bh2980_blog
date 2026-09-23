import { describe, expect, it } from "vitest";
import { keystaticPublishedAt } from "@/libs/contents/published-at";
import { formatPublishedAt, publishedAtFormatter } from "./format-published-at";

/**
 * 표시 날짜가 **실행 환경 타임존에 묶이지 않고 KST로 고정**되는지 고정한다.
 *
 * 이관 전에는 파일 기반 경로가 Keystatic의 잘못된 `Z` 값을 그대로 넘겼고, UTC 런타임에서
 * 우연히 KST 벽시계가 그대로 보였다. 이관 후 DB는 `+09:00`(정확한 순간)을 주므로
 * `timeZone`을 지정하지 않으면 UTC 런타임에서 하루 앞당겨진다.
 */
describe("formatPublishedAt", () => {
	it("타임존을 KST로 고정한다", () => {
		// 실행 환경 로컬 타임존이 KST여도 이 단언은 실패한다(`timeZone`을 빼면 undefined가 된다).
		expect(publishedAtFormatter.resolvedOptions().timeZone).toBe("Asia/Seoul");
		expect(formatPublishedAt("2026-04-10T03:12:00.000+09:00")).toBe("2026년 4월 10일");
	});

	it("KST 벽시계 00:00~08:59 발행분이 UTC 런타임에서 하루 밀리지 않는다", () => {
		// DB(운영)가 주는 정확한 순간들. UTC로 읽으면 전부 하루 전 날짜가 된다.
		const cases: Array<[string, string]> = [
			["2026-01-04T16:15:00.000Z", "2026년 1월 5일"], // 3057-push  = 01-05 01:15 KST
			["2026-01-04T16:16:00.000Z", "2026년 1월 5일"], // 3060-unshift
			["2026-01-04T16:20:00.000Z", "2026년 1월 5일"], // 3312-parameters
			["2026-01-04T16:40:00.000Z", "2026년 1월 5일"], // 2-get-return-type
			["2026-01-04T16:59:00.000Z", "2026년 1월 5일"], // 3-omit
			["2026-01-04T17:29:00.000Z", "2026년 1월 5일"], // 8-readonly-2
			["2026-02-12T15:21:00.000Z", "2026년 2월 13일"], // 블로그라면-seo는-해봐야지
			["2026-04-09T18:12:00.000Z", "2026년 4월 10일"], // 내가-만든-rag의-성능-측정하기
		];

		for (const [instant, expected] of cases) {
			expect(formatPublishedAt(instant), instant).toBe(expected);
		}
	});

	it("파일 원문은 저장소가 KST로 정규화해야 한다", () => {
		// 파일은 KST 벽시계를 UTC로 잘못 적어 두었고(`Z`), DB는 그 벽시계를 `+09:00`으로 해석한다.
		const fileValue = "2026-01-05T19:38:00.000Z"; // 의도한 시각: 2026-01-05 19:38 KST
		const dbValue = keystaticPublishedAt(fileValue);

		expect(dbValue).toBe("2026-01-05T19:38:00.000+09:00");
		expect(formatPublishedAt(dbValue as string)).toBe("2026년 1월 5일");

		// 원문을 정규화 없이 KST로 그대로 읽으면 다음 날이 된다 —
		// 그래서 `keystatic` 저장소가 `keystaticPublishedAt`을 거쳐야 한다.
		expect(formatPublishedAt(fileValue)).toBe("2026년 1월 6일");
	});

	it("값이 없거나 깨져 있으면 원문을 그대로 돌려준다", () => {
		expect(formatPublishedAt("설명할 수 없는 값")).toBe("설명할 수 없는 값");
		expect(keystaticPublishedAt(null)).toBeNull();
	});
});
