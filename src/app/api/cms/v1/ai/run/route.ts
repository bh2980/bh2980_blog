import { withBuiltin } from "@bh2980/cms/ai/builtins";
import { aiRunBodySchema } from "@bh2980/cms/ai/definition";
import { AiError } from "@bh2980/cms/ai/errors";
import { runAiFeature } from "@bh2980/cms/ai/run";
import { loadAiRuntime } from "@bh2980/cms/ai/settings";
import { getCmsContentStore } from "@bh2980/cms/container";
import { adminRoute, json, parseWith, readJsonBody } from "../../handler";
import { aiRunDeps, parseFeatureSpec } from "../ai-route";

/**
 * AI 기능 하나를 실행해 결과(후보·글·메모)를 돌려준다. 값은 바꾸지 않는다. 적용은 화면에서 사용자가 누를 때 한다.
 * AI 화면의 `시험`은 저장하지 않은 설정 `draft`를 함께 보낸다.
 */
export const POST = adminRoute(async ({ request }) => {
	const store = getCmsContentStore();
	const body = parseWith(aiRunBodySchema, await readJsonBody(request));
	const feature = await store.getAiFeature(body.featureId);
	// 시험은 저장하지 않은 설정(`draft`)으로 돈다. 기능마다 정해 둔 부분은 그대로다.
	const spec = body.draft === undefined ? feature : withBuiltin(feature.builtin, parseFeatureSpec(body.draft));
	if (!spec) throw new AiError("ai_failed", "알 수 없는 AI 기능입니다.");
	if (body.draft === undefined && !spec.enabled) throw new AiError("ai_unavailable", "꺼진 AI 기능입니다.");

	const runtime = await loadAiRuntime(store, spec);
	const started = Date.now();
	const result = await runAiFeature(
		spec,
		body.context,
		aiRunDeps(runtime, request.signal, new URL(request.url).origin),
	);
	const model = spec.engine === "decide" ? runtime.decider?.model : runtime.generator?.model;
	// 본문·결과는 남기지 않는다.
	console.info(`[cms-ai] ${spec.name} (${spec.slot}/${spec.target}) model=${model} ${Date.now() - started}ms`);
	return json({ result });
});
