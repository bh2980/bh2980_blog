/** 플러그인 이름. 서버 글 갈고리가 잠근 글의 `lockedBy`이고, 관리자 화면 글 동작 확장의 이름이다. */
export const SCHEDULE_PLUGIN_NAME = "schedule";

export interface ScheduleOptions {
	/**
	 * 외부 실행기가 예약 실행 API를 부를 때 보내는 토큰을 둔 서버 환경 변수 이름. 기본 `CMS_SCHEDULER_TOKEN`.
	 * 값이 없으면 예약 실행 API를 막고, 편집 화면은 "실행기 연결 필요"를 알린다.
	 */
	readonly tokenEnv?: string;
}

export interface ResolvedScheduleOptions {
	readonly tokenEnv: string;
}

export const resolveScheduleOptions = (options?: ScheduleOptions): ResolvedScheduleOptions => ({
	tokenEnv: options?.tokenEnv ?? "CMS_SCHEDULER_TOKEN",
});

/** 예약 API 경로(`/api/cms/` 뒤). 예전 본체 경로와 같다(외부 실행기 설정을 바꾸지 않는다). */
export const SCHEDULE_ROUTES = {
	entry: "v1/entries/[id]/schedule",
	due: "v1/schedules/due",
	run: "v1/schedules/[id]/publish",
} as const;
