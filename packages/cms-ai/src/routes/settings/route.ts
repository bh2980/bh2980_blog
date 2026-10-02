import { adminRoute, json } from "@bh2980/cms/http/v1/handler";
import { getAiSettingsView } from "../../settings";
import { getAiStore } from "../../store";

/** 저장한 AI 연결 목록. 키는 끝 네 글자만 돌려준다. */
export const GET = adminRoute(async () => json(await getAiSettingsView(getAiStore())));
