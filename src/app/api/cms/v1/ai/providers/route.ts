import { aiProviderRequestSchema } from "@bh2980/cms/ai/connection";
import { addAiProvider } from "@bh2980/cms/ai/settings";
import { getCmsContentStore } from "@bh2980/cms/container";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";

/** 연결 추가. 설정 전체의 버전이 다르면 409다. */
export const POST = adminRoute(async ({ request }) => {
	const { expectedVersion, provider } = parseWith(aiProviderRequestSchema, await readJsonBody(request));
	return json(await addAiProvider(getCmsContentStore(), expectedVersion, provider), { status: 201 });
});
