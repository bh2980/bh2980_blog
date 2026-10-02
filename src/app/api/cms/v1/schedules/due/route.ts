import { getCmsContentStore } from "@bh2980/cms/container";
import { json, schedulerRoute } from "../../handler";

/** 도래한 예약 조회(외부 실행기). 실행 성공을 뜻하지 않는다. */
export const GET = schedulerRoute(async () => json({ schedules: await getCmsContentStore().getDueSchedules() }));
