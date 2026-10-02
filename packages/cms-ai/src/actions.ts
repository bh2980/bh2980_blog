import {
	type AiActionDefinition,
	type AiActionEditable,
	type AiActionOverride,
	type AiAttach,
	type AiChoices,
	type AiInputKind,
	aiActionOverrideSchema,
	EDITABLE_KEYS,
	overrideFrom,
	type ResolvedAiAction,
	resolveAction,
	unknownPlaceholders,
} from "./action";
import {
	type AiApply,
	type AiCheck,
	type AiEngine,
	type AiPick,
	type AiResult,
	migrateLegacyCheck,
} from "./definition";
import { AiError } from "./errors";
import { AI_ACTIONS, AI_SHARED_KEYS, actionDefinition } from "./registry";

/**
 * 기능 정의(설정)와 고친 값(DB)을 합쳐 다룬다. 관리자 AI 화면·실행 API가 쓴다.
 * 정의에 없는 이름의 고친 값은 무시한다(설정에서 기능을 지운 경우).
 */

export interface AiActionsStore {
	listAiActionOverrides(): Promise<Array<{ key: string; value: unknown; version: number; updatedAt: Date }>>;
	saveAiActionOverride(params: {
		key: string;
		expectedVersion: number;
		value: unknown;
	}): Promise<{ key: string; value: unknown; version: number; updatedAt: Date }>;
}

/** 관리자 화면에 보내는 기능 하나. 정의의 고정 부분과 지금 값(고친 값을 얹은 것). */
export interface AiActionView extends AiActionEditable {
	key: string;
	label: string;
	result: AiResult;
	apply: AiApply;
	engine: AiEngine;
	pick: AiPick;
	input: Record<string, { kind: AiInputKind; label: string; required: boolean }>;
	choices?: AiChoices;
	attach: readonly AiAttach[];
	checks: AiCheck[];
	/** 결과를 흘려받는 기능인가. */
	stream: boolean;
	/** 고친 값의 버전. 고친 적 없으면 0. */
	version: number;
	updatedAt: string | null;
	/** 기본값과 다른 값 이름. */
	overridden: string[];
}

/** 저장된 고친 값을 읽는다. 모양이 맞지 않는 값은 버린다(정의가 바뀌어 맞지 않게 된 경우). */
const readOverride = (value: unknown): AiActionOverride => {
	const parsed = aiActionOverrideSchema.safeParse(value);
	return parsed.success ? parsed.data : {};
};

const viewOf = (
	action: ResolvedAiAction,
	row: { value: unknown; version: number; updatedAt: Date } | undefined,
): AiActionView => ({
	key: action.key,
	label: action.label,
	result: action.result,
	apply: action.apply,
	engine: action.engine,
	pick: action.pick,
	input: Object.fromEntries(
		Object.entries(action.input).map(([name, spec]) => [
			name,
			{ kind: spec.kind, label: spec.label, required: spec.required === true },
		]),
	),
	...(action.choices ? { choices: action.choices } : {}),
	attach: action.attach,
	stream: action.stream,
	enabled: action.enabled,
	askInstruction: action.askInstruction,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: [...action.checks],
	send: [...action.send],
	version: row?.version ?? 0,
	updatedAt: row ? row.updatedAt.toISOString() : null,
	overridden: Object.keys(readOverride(row?.value)),
});

const definitionOf = (key: string): AiActionDefinition => {
	const definition = actionDefinition(key);
	if (!definition) throw new AiError("ai_unknown_action", "알 수 없는 AI 기능입니다.");
	return definition;
};

/** 기능 하나(고친 값을 얹은 것). */
export async function getAction(store: AiActionsStore, key: string): Promise<ResolvedAiAction> {
	const definition = definitionOf(key);
	const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
	return resolveAction(key, definition, readOverride(row?.value));
}

/** 설정 순서대로 모든 기능. */
export async function listActions(store: AiActionsStore): Promise<AiActionView[]> {
	const rows = new Map((await store.listAiActionOverrides()).map((row) => [row.key, row]));
	return Object.entries(AI_ACTIONS).map(([key, definition]) => {
		const row = rows.get(key);
		return viewOf(resolveAction(key, definition, readOverride(row?.value)), row);
	});
}

/**
 * 고칠 수 있는 값으로 시험·저장할 기능을 만든다. 지시문의 `{{이름}}`은 언어 입력만 받는다.
 * 고칠 수 없는 값(이름·결과 모양 등)은 보내도 무시한다.
 */
export function actionWithEdits(key: string, edited: unknown): ResolvedAiAction {
	const definition = definitionOf(key);
	const parsed = aiActionOverrideSchema.safeParse(
		edited && typeof edited === "object"
			? Object.fromEntries(
					EDITABLE_KEYS.filter((name) => name in edited).map((name) => [
						name,
						(edited as Record<string, unknown>)[name],
					]),
				)
			: {},
	);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
		throw new AiError("ai_invalid_input", `${where}${issue?.message ?? "값이 올바르지 않습니다."}`);
	}
	const unknown = parsed.data.prompt ? unknownPlaceholders(parsed.data.prompt, definition.input, AI_SHARED_KEYS) : [];
	if (unknown.length > 0) {
		throw new AiError(
			"ai_invalid_input",
			`지시문에는 언어 입력과 공통 문구만 {{이름}}으로 넣을 수 있습니다: {{${unknown[0]}}}`,
		);
	}
	return resolveAction(key, definition, overrideFrom(definition, parsed.data));
}

/** 고친 값을 저장한다. 기본값과 같은 값은 저장하지 않는다. */
export async function updateAction(
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
	edited: unknown,
): Promise<AiActionView> {
	const action = actionWithEdits(key, edited);
	const definition = definitionOf(key);
	const value = overrideFrom(definition, action);
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(action, row);
}

/** 기본값으로 되돌린다. 켜짐 여부는 지금 값을 둔다. */
export async function resetAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<AiActionView> {
	const current = await getAction(store, key);
	const definition = definitionOf(key);
	const value = overrideFrom(definition, { enabled: current.enabled });
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(resolveAction(key, definition, value), row);
}

/**
 * 예전 AI 기능 표(`ai_features`)의 저장 값을 기능 이름별 고친 값으로 옮긴다. 정의와 다른 값만 남긴다.
 * 정의에 없는 이름(설정에서 뺀 기능, 예전에 지운 `mediaAlt` 등)은 `null`이다.
 * 예전 `보낼 내용`(inputs)은 `send`가 되고, 정의에 없는 입력(예: `tags`)은 빠진다.
 */
export function legacyFeatureOverride(key: string, spec: unknown): AiActionOverride | null {
	const definition = actionDefinition(key);
	if (!definition || !spec || typeof spec !== "object") return null;
	const raw = migrateLegacyCheck(spec) as Record<string, unknown>;
	const edited: Record<string, unknown> = {};
	const take = (name: keyof AiActionOverride, value: unknown) => {
		const parsed = aiActionOverrideSchema.shape[name].safeParse(value);
		if (parsed.success) edited[name] = parsed.data;
	};
	for (const name of [
		"enabled",
		"askInstruction",
		"providerId",
		"modelName",
		"prompt",
		"threshold",
		"maxCount",
	] as const) {
		if (raw[name] !== undefined) take(name, raw[name]);
	}
	// 예전 번역처럼 보낼 내용을 고르지 않던 기능은 빈 목록이었다. 빈 목록은 옮기지 않는다.
	if (Array.isArray(raw.inputs) && raw.inputs.length > 0) {
		take(
			"send",
			raw.inputs.filter(
				(input): input is string => typeof input === "string" && Object.hasOwn(definition.input, input),
			),
		);
	}
	if (Array.isArray(raw.checks)) take("checks", raw.checks);
	return overrideFrom(definition, resolveAction(key, definition, edited as AiActionOverride));
}
