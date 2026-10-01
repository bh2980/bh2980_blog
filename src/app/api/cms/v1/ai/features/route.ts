import { usableFeatureIds } from "@/cms/ai/settings";
import { getCmsContentStore } from "@/cms/container";
import { adminRoute, json } from "../../handler";

/** AI 기능 목록과 지금 쓸 수 있는(연결이 준비된) 기능 id. 자리는 켜진 기능 중 쓸 수 있는 것만 붙인다. */
export const GET = adminRoute(async () => {
	const store = getCmsContentStore();
	const items = await store.listAiFeatures();
	return json({ usable: await usableFeatureIds(store, items), items });
});
