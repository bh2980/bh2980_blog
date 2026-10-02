import { getCmsContentStore } from "@bh2980/cms/container";
import { scheduleBodySchema } from "@bh2980/cms/core/api";
import { HttpError } from "../../../error-handler";
import { adminRoute, json, readVersionedBody } from "../../../handler";

type IdParams = { id: string };

/** 예약 등록(§5.4). 저장된 초안을 발행 검증한 뒤 미래 시각만 받는다. 변경은 해제 후 다시 등록한다. */
export const POST = adminRoute<IdParams>(async ({ request, params }) => {
	const body = await readVersionedBody(request, scheduleBodySchema);
	const schedule = await getCmsContentStore().createSchedule({
		entryId: params.id,
		expectedVersion: body.expectedVersion,
		scheduledAt: new Date(body.scheduledAt),
	});
	return json(schedule, { status: 201 });
});

/** 예약 해제(`예약 해제`). 대기 중인 예약이 없으면 404다. */
export const DELETE = adminRoute<IdParams>(async ({ request, params }) => {
	const scheduleId = request.nextUrl.searchParams.get("scheduleId");
	if (!scheduleId) throw new HttpError(400, "invalid_input", "scheduleId query parameter is required");
	const cancelled = await getCmsContentStore().cancelSchedule({ scheduleId, entryId: params.id });
	if (!cancelled) throw new HttpError(404, "not_found", "No pending schedule");
	return json({ id: scheduleId, status: "cancelled" });
});
