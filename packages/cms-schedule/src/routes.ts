import { timingSafeEqual } from "node:crypto";
import { versionBodySchema } from "@bh2980/cms/client";
import {
	AuthError,
	adminRoute,
	getCmsContentStore,
	getCmsDatabase,
	HttpError,
	handleApiError,
	json,
	readVersionedBody,
} from "@bh2980/cms/plugin/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { ResolvedScheduleOptions } from "./options";
import { createScheduleStore } from "./store";

const scheduleBodySchema = versionBodySchema.extend({ scheduledAt: z.iso.datetime({ offset: true }) });

type IdParams = { id: string };

const store = () => createScheduleStore(getCmsDatabase(), getCmsContentStore());

/** 길이를 먼저 보고 시간이 일정한 비교로 토큰을 맞춘다. 앞뒤 공백은 무시한다. */
export function tokenMatches(expected: string | undefined, provided: string | null | undefined): boolean {
	const want = expected?.trim();
	const got = provided?.trim();
	if (!want || !got || got.length !== want.length) return false;
	try {
		return timingSafeEqual(Buffer.from(got), Buffer.from(want));
	} catch {
		return false;
	}
}

/**
 * 외부 실행기 전용 라우트. 관리자 세션 대신 `Authorization: Bearer <토큰>`만 받는다.
 * 토큰은 URL 쿼리나 브라우저 코드에 넣지 않는다(§10.2).
 */
function runnerRoute<P extends Record<string, string>>(
	options: ResolvedScheduleOptions,
	handler: (input: { request: NextRequest; params: P }) => Promise<Response>,
) {
	return async (request: NextRequest, context?: { params: Promise<P> }) => {
		try {
			const header = request.headers.get("authorization");
			const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
			if (!tokenMatches(process.env[options.tokenEnv], token)) {
				throw new AuthError("forbidden", `Invalid or missing ${options.tokenEnv}`);
			}
			const params = (await context?.params) ?? ({} as P);
			return await handler({ request, params });
		} catch (error) {
			return handleApiError(error);
		}
	};
}

/** 예약 API 경로 모듈. */
export function scheduleRoutes(options: ResolvedScheduleOptions) {
	return {
		entry: {
			/** 편집 화면의 예약 상태(대기·마지막 결과·실행기 연결 여부). */
			GET: adminRoute<IdParams>(async ({ params }) =>
				json({
					...(await store().getEntrySchedule({ entryId: params.id })),
					runnerConfigured: Boolean(process.env[options.tokenEnv]?.trim()),
				}),
			),
			/** 예약 등록. 저장된 초안을 발행 검증한 뒤 미래 시각만 받는다. 바꾸려면 해제하고 다시 등록한다. */
			POST: adminRoute<IdParams>(async ({ request, params }) => {
				const body = await readVersionedBody(request, scheduleBodySchema);
				const created = await store().createSchedule({
					entryId: params.id,
					expectedVersion: body.expectedVersion,
					scheduledAt: new Date(body.scheduledAt),
				});
				return json(created, { status: 201 });
			}),
			/** 예약 해제. 대기 중인 예약이 없으면 404다. */
			DELETE: adminRoute<IdParams>(async ({ request, params }) => {
				const scheduleId = request.nextUrl.searchParams.get("scheduleId");
				if (!scheduleId) throw new HttpError(400, "invalid_input", "scheduleId query parameter is required");
				const cancelled = await store().cancelSchedule({ scheduleId, entryId: params.id });
				if (!cancelled) throw new HttpError(404, "not_found", "No pending schedule");
				return json({ id: scheduleId, status: "cancelled" });
			}),
		},
		/** 도래한 예약 조회(외부 실행기). 실행 성공을 뜻하지 않는다. */
		due: { GET: runnerRoute(options, async () => json({ schedules: await store().getDueSchedules() })) },
		/** 예약 1건 실행(외부 실행기). 같은 예약의 중복 호출은 다시 발행하지 않는다(§5.4). */
		run: {
			POST: runnerRoute<IdParams>(options, async ({ params }) =>
				json(await store().executeSchedulePublish({ scheduleId: params.id })),
			),
		},
	};
}
