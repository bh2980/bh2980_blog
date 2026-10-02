import { getCmsContentStore } from "@bh2980/cms/container";
import { json, schedulerRoute } from "../../../handler";

/** 예약 1건 실행(외부 실행기). 같은 예약의 중복 호출은 다시 발행하지 않는다(§5.4). */
export const POST = schedulerRoute<{ id: string }>(async ({ params }) =>
	json(await getCmsContentStore().executeSchedulePublish({ scheduleId: params.id })),
);
