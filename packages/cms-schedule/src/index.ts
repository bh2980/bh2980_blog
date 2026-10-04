import { definePlugin } from "@bh2980/cms";
import { resolveScheduleOptions, SCHEDULE_PLUGIN_NAME, type ScheduleOptions } from "./options";

export {
	type ResolvedScheduleOptions,
	SCHEDULE_PLUGIN_NAME,
	SCHEDULE_ROUTES,
	type ScheduleOptions,
} from "./options";
export type { EntrySchedule, ScheduleSummary } from "./types";

/**
 * 발행 예약. 사이트 설정의 `plugins`에 넣으면 편집 화면 발행 메뉴에 "발행 예약"이 생기고, 예약이 걸린 글은 편집이 잠긴다.
 * 정해진 시각의 실행은 외부 실행기가 맡는다: 실행기는 `GET /api/cms/v1/schedules/due`로 도래한 예약을 받아
 * `POST /api/cms/v1/schedules/<예약 ID>/publish`로 하나씩 실행한다(`Authorization: Bearer <토큰>`).
 *
 * ```ts
 * plugins: [schedule()]
 * ```
 */
export const schedule = (options?: ScheduleOptions) =>
	definePlugin({
		name: SCHEDULE_PLUGIN_NAME,
		options: resolveScheduleOptions(options),
		// 브라우저 묶음에서는 `./server`가 빈 진입점(`server.browser.ts`)으로 바뀐다(package.json `exports`).
		server: () => import("@bh2980/cms-schedule/server"),
		admin: () => import("@bh2980/cms-schedule/admin"),
	});
