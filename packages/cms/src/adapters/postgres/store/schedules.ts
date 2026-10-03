import { randomUUID } from "node:crypto";
import { isItemCollection } from "../../../core/collections";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, isTransactionConflict, isUniqueViolation, mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import { lockEntryForUpdate, mapScheduleRow, SCHEDULE_COLUMNS, type ScheduleRow } from "./rows";
import type { EntrySchedule } from "./types";

/** 실행 단계에서 난 실패만 예약에 기록한다. 이르거나 이미 끝난 예약 호출은 예약 상태를 바꾸지 않는다. */
class ScheduleExecutionFailure extends Error {
	constructor(readonly cause: unknown) {
		super("schedule execution failed");
	}
}

const failureOf = (err: unknown): { code: string; detail: string } => {
	const { code, message, issues } = (err ?? {}) as { code?: unknown; message?: unknown; issues?: unknown };
	return {
		code: typeof code === "string" ? code : "internal",
		detail: Array.isArray(issues)
			? JSON.stringify(issues).slice(0, 2000)
			: typeof message === "string"
				? message.slice(0, 2000)
				: "",
	};
};

/**
 * §5.4 예약. CMS는 실행기를 돌리지 않는다. 외부 실행기가 도래한 예약을 조회하고 예약 ID로 실행한다.
 */
export function createScheduleOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema } = ctx;

	return {
		/** 저장된 초안을 발행 검증한 뒤 미래 시각의 새 예약을 만든다. 같은 글의 대기 예약은 하나뿐이다. */
		createSchedule: async (params: {
			entryId: string;
			expectedVersion: number;
			scheduledAt: Date;
			now?: Date;
		}): Promise<{ id: string; status: string; scheduledAt: Date }> =>
			withTransaction(
				pool,
				async (client) => {
					const now = params.now ?? new Date();
					if (!Number.isFinite(params.scheduledAt.getTime()) || params.scheduledAt.getTime() <= now.getTime()) {
						throw new CmsError("scheduledAt must be in the future", "invalid_input");
					}
					const locked = await lockEntryForUpdate(client, qSchema, params.entryId, params.expectedVersion);
					if (isItemCollection(locked.collection)) {
						throw new CmsError("Record collections are saved immediately and cannot be scheduled", "invalid_input");
					}
					if (locked.status !== "draft" && locked.status !== "published") {
						throw new CmsError(`A ${locked.status} entry cannot be scheduled`, "invalid_status");
					}
					await publishing.validateStoredWorkingForPublish(client, params.entryId);

					const id = randomUUID();
					await client.query(
						`INSERT INTO "${qSchema}".schedules (id, entry_id, scheduled_at, status, created_at)
						 VALUES ($1, $2, $3, 'pending', $4)`,
						[id, params.entryId, params.scheduledAt, now],
					);
					return { id, status: "pending", scheduledAt: params.scheduledAt };
				},
				{
					// M7-TW-1: 같은 항목에 pending 예약은 하나만 존재한다(schedules_active_entry_idx).
					mapError: (err) =>
						isUniqueViolation(err, "schedules_active_entry_idx")
							? new CmsError("Entry already has a pending schedule", "conflict")
							: mapEntryWriteError(err),
				},
			),

		/** 예약 해제. 대기 중인 예약이 없으면 `false`다. */
		cancelSchedule: async (params: { scheduleId: string; entryId: string }): Promise<boolean> => {
			const res = await pool.query(
				`UPDATE "${qSchema}".schedules SET status = 'cancelled', completed_at = NOW()
				 WHERE id = $1 AND entry_id = $2 AND status = 'pending'`,
				[params.scheduleId, params.entryId],
			);
			return (res.rowCount ?? 0) > 0;
		},

		/** 편집 화면의 예약 표시: 대기 중인 예약과 마지막으로 끝난 예약(성공·실패·취소). */
		getEntrySchedule: async (params: { entryId: string }): Promise<EntrySchedule> => {
			const res = await pool.query<ScheduleRow>(
				`(SELECT ${SCHEDULE_COLUMNS} FROM "${qSchema}".schedules WHERE entry_id = $1 AND status = 'pending' LIMIT 1)
				 UNION ALL
				 (SELECT ${SCHEDULE_COLUMNS} FROM "${qSchema}".schedules WHERE entry_id = $1 AND status <> 'pending'
				  ORDER BY COALESCE(completed_at, created_at) DESC, id DESC LIMIT 1)`,
				[params.entryId],
			);
			const rows = res.rows.map(mapScheduleRow);
			return {
				pending: rows.find((row) => row.status === "pending") ?? null,
				last: rows.find((row) => row.status !== "pending") ?? null,
			};
		},

		getDueSchedules: async (): Promise<Array<{ id: string; entryId: string; scheduledAt: Date }>> => {
			const res = await pool.query<{ id: string; entry_id: string; scheduled_at: Date }>(
				`SELECT id, entry_id, scheduled_at FROM "${qSchema}".schedules
				 WHERE status = 'pending' AND scheduled_at <= $1 ORDER BY scheduled_at ASC`,
				[new Date()],
			);
			return res.rows.map((r) => ({ id: r.id, entryId: r.entry_id, scheduledAt: r.scheduled_at }));
		},

		/**
		 * 예약 1건 실행. 예약 ID·예정 시각·상태를 잠금 아래 다시 확인하고, 같은 예약의 중복 호출은
		 * 다시 발행하지 않는다. 발행 조건이 깨졌으면 공개본을 유지하고 예약을 `failed`로 남긴다(§5.4).
		 */
		executeSchedulePublish: async (params: { scheduleId: string }): Promise<{ status: string }> => {
			try {
				return await withTransaction(pool, async (client) => {
					const previewRes = await client.query<{ entry_id: string; status: string; scheduled_at: Date }>(
						`SELECT entry_id, status, scheduled_at FROM "${qSchema}".schedules WHERE id = $1`,
						[params.scheduleId],
					);
					const preview = previewRes.rows[0];
					if (!preview) throw new CmsError("Schedule not found", "not_found");
					if (preview.status === "completed") return { status: "completed" };
					if (preview.status !== "pending") {
						throw new CmsError(`Schedule cannot be executed in status: ${preview.status}`, "conflict");
					}
					if (preview.scheduled_at.getTime() > Date.now()) throw new CmsError("Schedule is not due yet", "conflict");

					// 예약 등록과 같은 순서(항목 → 예약)로 잠근 뒤 예약 행을 다시 확인한다.
					const locked = await lockEntryForUpdate(client, qSchema, preview.entry_id);
					const schedRes = await client.query<{ entry_id: string; status: string; scheduled_at: Date }>(
						`SELECT entry_id, status, scheduled_at FROM "${qSchema}".schedules WHERE id = $1 FOR UPDATE`,
						[params.scheduleId],
					);
					const sched = schedRes.rows[0];
					if (!sched) throw new CmsError("Schedule not found", "not_found");
					if (sched.status === "completed") return { status: "completed" };
					if (sched.status !== "pending" || sched.entry_id !== preview.entry_id) {
						throw new CmsError(`Schedule cannot be executed in status: ${sched.status}`, "conflict");
					}
					if (sched.scheduled_at.getTime() > Date.now()) throw new CmsError("Schedule is not due yet", "conflict");

					try {
						await publishing.publishWithinTransaction(client, sched.entry_id, {
							expectedVersion: locked.version,
							scheduleId: params.scheduleId,
						});
					} catch (err) {
						throw new ScheduleExecutionFailure(err);
					}
					await client.query(
						`UPDATE "${qSchema}".schedules SET status = 'completed', completed_at = $1 WHERE id = $2`,
						[new Date(), params.scheduleId],
					);
					return { status: "completed" };
				});
			} catch (err) {
				if (!(err instanceof ScheduleExecutionFailure)) throw mapEntryWriteError(err);
				const cause = mapEntryWriteError(err.cause);
				// 교착 같은 일시 충돌은 실행기가 다시 부를 수 있게 대기 상태로 둔다.
				if (isTransactionConflict(err.cause)) throw cause;
				const failure = failureOf(cause);
				await pool.query(
					`UPDATE "${qSchema}".schedules SET status = 'failed', completed_at = NOW(), failure_code = $2, failure_detail = $3
					 WHERE id = $1 AND status = 'pending'`,
					[params.scheduleId, failure.code, failure.detail],
				);
				throw cause;
			}
		},
	};
}
