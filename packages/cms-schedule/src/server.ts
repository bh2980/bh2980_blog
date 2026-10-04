import type { CmsPlugin, CmsServerPlugin } from "@bh2980/cms";
import { cmsConfig } from "@bh2980/cms/client";
import { type ResolvedScheduleOptions, resolveScheduleOptions, SCHEDULE_PLUGIN_NAME, SCHEDULE_ROUTES } from "./options";
import { scheduleRoutes } from "./routes";
import { migrateSchedules, scheduleEntryHooks } from "./store";

export { createScheduleStore, migrateSchedules, type ScheduleStore, scheduleEntryHooks } from "./store";

/** 사이트 설정에 적은 예약 플러그인의 설정 값. 플러그인이 없는 설정은 빈 튜플 타입이라 넓혀 읽는다. */
const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
const options =
	(plugins.find((plugin) => plugin.name === SCHEDULE_PLUGIN_NAME)?.options as ResolvedScheduleOptions | undefined) ??
	resolveScheduleOptions();

const routes = scheduleRoutes(options);

/** 예약의 서버 쪽: 예약 표, 예약 API, 예약이 걸린 글의 잠금과 취소. 브라우저 묶음에는 들어가지 않는다. */
const scheduleServer: CmsServerPlugin = {
	routes: [
		{ pattern: SCHEDULE_ROUTES.entry, module: routes.entry },
		{ pattern: SCHEDULE_ROUTES.due, module: routes.due },
		{ pattern: SCHEDULE_ROUTES.run, module: routes.run },
	],
	migrate: migrateSchedules,
	entryHooks: scheduleEntryHooks,
};

export default scheduleServer;
