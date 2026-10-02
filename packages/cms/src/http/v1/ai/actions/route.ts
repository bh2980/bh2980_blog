import { listActions } from "../../../../ai/actions";
import { usableActionKeys } from "../../../../ai/settings";
import { getCmsContentStore } from "../../../../container";
import { adminRoute, json } from "../../handler";

/** AI 기능 목록(정의 + 고친 값)과 지금 쓸 수 있는(연결이 준비된) 기능 이름. 자리는 켜진 기능 중 쓸 수 있는 것만 붙인다. */
export const GET = adminRoute(async () => {
	const store = getCmsContentStore();
	const items = await listActions(store);
	return json({ usable: await usableActionKeys(store, items), items });
});
