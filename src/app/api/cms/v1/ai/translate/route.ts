import { withBuiltin } from "@/cms/ai/builtins";
import { AiError } from "@/cms/ai/errors";
import { loadAiRuntime } from "@/cms/ai/settings";
import { aiTranslateBodySchema, translateBlocks } from "@/cms/ai/translate";
import { getCmsContentStore } from "@/cms/container";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";
import { parseFeatureSpec } from "../ai-route";

/**
 * 본문 블록 번역(v2 D2). 번역본 에디터가 안내 글이 남은 블록의 원문 MDX를 몇 개씩 보낸다.
 * 블록마다 번역·구조 검사 결과(`mdx`) 또는 실패 이유(`error`)를 돌려준다. 값은 화면이 넣는다.
 */
export const POST = adminRoute(async ({ request }) => {
	const store = getCmsContentStore();
	const body = parseWith(aiTranslateBodySchema, await readJsonBody(request));
	const saved = (await store.listAiFeatures()).find((item) => item.builtin === "translate");
	const feature = body.draft === undefined ? saved : withBuiltin("translate", parseFeatureSpec(body.draft));
	if (!feature) throw new AiError("ai_unavailable", "번역 기능이 없습니다.");
	if (body.draft === undefined && !feature.enabled) throw new AiError("ai_unavailable", "번역 기능이 꺼져 있습니다.");
	const { generator } = await loadAiRuntime(store, feature);
	if (!generator) throw new AiError("ai_unavailable", "번역에 쓸 생성 연결이 없습니다.");

	const started = Date.now();
	const results = await translateBlocks(feature, body, generator, request.signal);
	const failed = results.filter((result) => "error" in result).length;
	// 본문·결과는 남기지 않는다.
	console.info(
		`[cms-ai] 번역 ${body.sourceLocale}→${body.targetLocale} blocks=${results.length} failed=${failed} model=${generator.model} ${Date.now() - started}ms`,
	);
	return json({ results });
});
