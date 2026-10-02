import { adminRoute, json, parseWith, readJsonBody } from "@bh2980/cms/plugin/server";
import { type AiRunBody, aiRunBodySchema, inputSchemaFor, type ResolvedAiAction } from "../../action";
import { actionWithEdits, getAction } from "../../actions";
import { AiError } from "../../errors";
import { type AiCall, type AiRunDeps, runAiAction } from "../../run";
import { loadAiRuntime } from "../../settings";
import { getAiStore } from "../../store";
import { aiRunDeps } from "../ai-route";

/** 묶음 실행에서 동시에 부르는 수. */
const CONCURRENCY = 3;

/** 기능 하나를 입력 하나에 돌린다. 기능 정의에 맞지 않는 입력은 400이다. */
async function runOne(action: ResolvedAiAction, body: AiRunBody, input: unknown, deps: AiRunDeps) {
	const parsed = parseWith(inputSchemaFor(action.input), input, "Invalid AI input");
	const call: AiCall = { input: parsed as Record<string, unknown>, env: body.env, request: body.request };
	return runAiAction(action, call, deps);
}

/**
 * AI 기능을 이름으로 실행해 결과(후보·글·MDX·메모)를 돌려준다. 값은 바꾸지 않는다. 적용은 화면에서 사용자가 누를 때 한다.
 * `inputs`(여러 입력)를 보내면 입력마다 결과나 실패 이유를 순서대로 돌려준다(번역의 `모두 번역`). 키·크레딧·요청 수
 * 문제처럼 다른 입력도 같을 문제는 요청 전체를 멈춘다. AI 화면의 `시험`은 저장하지 않은 고친 값 `draft`를 함께 보낸다.
 */
export const POST = adminRoute(async ({ request }) => {
	const store = getAiStore();
	const body = parseWith(aiRunBodySchema, await readJsonBody(request));
	const action =
		body.draft === undefined ? await getAction(store, body.action) : actionWithEdits(body.action, body.draft);
	if (body.draft === undefined && !action.enabled) throw new AiError("ai_unavailable", "꺼진 AI 기능입니다.");

	const runtime = await loadAiRuntime(store, action);
	const deps = aiRunDeps(runtime, request.signal, new URL(request.url).origin);
	const model = action.engine === "decide" ? runtime.decider?.model : runtime.generator?.model;
	const started = Date.now();

	if (body.inputs === undefined) {
		const result = await runOne(action, body, body.input, deps);
		// 본문·결과는 남기지 않는다.
		console.info(`[cms-ai] ${action.key} model=${model} ${Date.now() - started}ms`);
		return json({ result });
	}

	const inputs = body.inputs;
	const results: Array<{ result: unknown } | { error: string }> = new Array(inputs.length);
	let next = 0;
	const worker = async () => {
		while (next < inputs.length) {
			const index = next++;
			try {
				results[index] = { result: await runOne(action, body, inputs[index], deps) };
			} catch (error) {
				// 한 입력의 형식 오류는 그 입력만 실패로 둔다.
				if (error instanceof AiError && error.code === "ai_failed") results[index] = { error: error.message };
				else throw error;
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(CONCURRENCY, inputs.length) }, worker));
	const failed = results.filter((item) => "error" in item).length;
	console.info(
		`[cms-ai] ${action.key} inputs=${inputs.length} failed=${failed} model=${model} ${Date.now() - started}ms`,
	);
	return json({ results });
});
