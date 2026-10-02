import { adminRoute, json, readJsonBody } from "@bh2980/cms/plugin/server";
import { getSharedView, updateShared } from "../../shared";
import { getAiStore } from "../../store";

/** 공통 문구(M8-4). 읽기와 고치기. 고칠 때는 `{ expectedVersion, texts }`를 보낸다. */
export const GET = adminRoute(async () => json(await getSharedView(getAiStore())));

export const PUT = adminRoute(async ({ request }) => {
	const body = (await readJsonBody(request)) as { expectedVersion?: unknown; texts?: unknown };
	const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : -1;
	return json(await updateShared(getAiStore(), expectedVersion, { texts: body.texts }));
});
