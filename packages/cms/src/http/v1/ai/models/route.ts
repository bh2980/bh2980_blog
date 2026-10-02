import { aiModelsQuerySchema } from "../../../../ai/connection";
import { isFakeAi, listModels } from "../../../../ai/provider";
import { savedProvider } from "../../../../ai/settings";
import { getCmsContentStore } from "../../../../container";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";

/**
 * 생성 연결 주소의 모델 목록(`GET {주소}/models`). 저장한 연결은 `providerId`로, 저장 전에는 주소·키로 부른다.
 * 키는 브라우저로 돌려보내지 않는다. 목록을 주지 않는 주소면 빈 목록이고, 화면은 이름을 직접 적게 한다.
 */
export const POST = adminRoute(async ({ request }) => {
	const query = parseWith(aiModelsQuerySchema, await readJsonBody(request));
	const saved = query.providerId ? await savedProvider(getCmsContentStore(), query.providerId) : null;
	if (saved && saved.kind !== "chat") return json({ items: [] });
	const url = query.url || saved?.url;
	if (!url) return json({ items: isFakeAi() ? [{ id: "fake-generator" }] : [] });
	// 주소를 바꿨는데 키를 새로 넣지 않았으면 저장된 키를 다른 주소로 보내지 않는다.
	const apiKey = query.apiKey ?? (saved && saved.url === url ? saved.apiKey : null);
	return json({ items: await listModels(url, apiKey, request.signal) });
});
