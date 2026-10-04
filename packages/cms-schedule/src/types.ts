/** 예약 하나. 시각은 서버 응답에서 ISO 문자열이다. */
export interface ScheduleSummary<Time = Date> {
	readonly id: string;
	readonly status: "pending" | "completed" | "cancelled" | "failed";
	readonly scheduledAt: Time;
	readonly createdAt: Time;
	readonly completedAt: Time | null;
	readonly failureCode: string | null;
	readonly failureDetail: string | null;
}

/** 편집 화면용 예약 상태. 대기 중인 예약과 마지막으로 끝난 예약 결과, 실행기 연결 여부. */
export interface EntrySchedule<Time = Date> {
	readonly pending: ScheduleSummary<Time> | null;
	readonly last: ScheduleSummary<Time> | null;
	readonly runnerConfigured: boolean;
}
