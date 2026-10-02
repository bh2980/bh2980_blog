import { getAiSettingsView } from "../../../../ai/settings";
import { getCmsContentStore } from "../../../../container";
import { adminRoute, json } from "../../handler";

/** 저장한 AI 연결 목록. 키는 끝 네 글자만 돌려준다. */
export const GET = adminRoute(async () => json(await getAiSettingsView(getCmsContentStore())));
