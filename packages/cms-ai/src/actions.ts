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
	type CustomBase,
	type CustomValue,
	customBaseSchema,
	customDefinition,
	customValueSchema,
	isCustomKey,
	newCustomKey,
	surfaceProblem,
} from "./custom";
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

type Row = { key: string; value: unknown; version: number; updatedAt: Date };

export interface AiActionsStore {
	listAiActionOverrides(): Promise<Row[]>;
	saveAiActionOverride(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	/** 화면 기능(M8-5). */
	listAiCustomActions(): Promise<Row[]>;
	saveAiCustomAction(params: { key: string; expectedVersion: number; value: unknown }): Promise<Row>;
	deleteAiCustomAction(params: { key: string; expectedVersion: number }): Promise<void>;
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
	/** 기능 정의가 정한 검사 종류(끌 수만 있다). 나머지는 관리자 화면에서 더한 검사다. */
	definedChecks: AiCheck["kind"][];
	/** 코드 검사(`validate`)가 있는가. 관리자 화면에서는 고칠 수 없다. */
	validated: boolean;
	/** 결과를 흘려받는 기능인가. */
	stream: boolean;
	/** 관리자 화면에서 만든 기능(화면 기능)이면 그 기본 정보(이름·붙을 곳·결과 모양). 코드 기능은 없다. */
	custom?: CustomBase;
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
	custom?: CustomValue,
): AiActionView => ({
	...(custom ? { custom: custom.base } : {}),
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
	instant: action.instant,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: [...action.checks],
	definedChecks: [...action.definedChecks],
	validated: !!action.validate,
	send: [...action.send],
	version: row?.version ?? 0,
	updatedAt: row ? row.updatedAt.toISOString() : null,
	overridden: Object.keys(custom ? custom.override : readOverride(row?.value)),
});

/** 저장한 화면 기능 한 줄. 모양이 맞지 않으면 `null`(정의가 바뀌어 맞지 않게 된 경우). */
const readCustom = (value: unknown): CustomValue | null => {
	const parsed = customValueSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
};

async function customRow(store: AiActionsStore, key: string): Promise<{ row: Row; value: CustomValue }> {
	const row = (await store.listAiCustomActions()).find((item) => item.key === key);
	const value = row ? readCustom(row.value) : null;
	if (!row || !value) throw new AiError("ai_unknown_action", "알 수 없는 AI 기능입니다.");
	return { row, value };
}

const definitionOf = (key: string): AiActionDefinition => {
	const definition = actionDefinition(key);
	if (!definition) throw new AiError("ai_unknown_action", "알 수 없는 AI 기능입니다.");
	return definition;
};

/** 기능 하나(고친 값을 얹은 것). 화면 기능도 같은 모양이다. */
export async function getAction(store: AiActionsStore, key: string): Promise<ResolvedAiAction> {
	if (isCustomKey(key)) {
		const { value } = await customRow(store, key);
		return resolveAction(key, customDefinition(value.base), value.override);
	}
	const definition = definitionOf(key);
	const row = (await store.listAiActionOverrides()).find((item) => item.key === key);
	return resolveAction(key, definition, readOverride(row?.value));
}

/** 설정 순서대로 모든 코드 기능, 그다음 만든 순서대로 화면 기능. */
export async function listActions(store: AiActionsStore): Promise<AiActionView[]> {
	const rows = new Map((await store.listAiActionOverrides()).map((row) => [row.key, row]));
	const code = Object.entries(AI_ACTIONS).map(([key, definition]) => {
		const row = rows.get(key);
		return viewOf(resolveAction(key, definition, readOverride(row?.value)), row);
	});
	const custom = (await store.listAiCustomActions()).flatMap((row) => {
		const value = readCustom(row.value);
		if (!value) return [];
		return [viewOf(resolveAction(row.key, customDefinition(value.base), value.override), row, value)];
	});
	return [...code, ...custom];
}

/**
 * 고칠 수 있는 값으로 시험·저장할 기능을 만든다. 지시문의 `{{이름}}`은 언어 입력만 받는다.
 * 고칠 수 없는 값(이름·결과 모양 등)은 보내도 무시한다.
 */
export function actionWithEdits(
	key: string,
	edited: unknown,
	definition: AiActionDefinition = definitionOf(key),
): ResolvedAiAction {
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

/** 저장하지 않은 고친 값으로 시험할 기능(AI 화면의 `시험`). 화면 기능은 저장한 기본 정보로 만든다. */
export async function actionWithDraft(store: AiActionsStore, key: string, edited: unknown): Promise<ResolvedAiAction> {
	if (!isCustomKey(key)) return actionWithEdits(key, edited);
	const { value } = await customRow(store, key);
	return actionWithEdits(key, edited, customDefinition(value.base));
}

/** 화면 기능의 기본 정보를 검사한다. */
function readBase(input: unknown): CustomBase {
	const parsed = customBaseSchema.safeParse(input);
	if (!parsed.success) {
		throw new AiError("ai_invalid_input", parsed.error.issues[0]?.message ?? "기본 정보가 올바르지 않습니다.");
	}
	const problem = surfaceProblem(parsed.data.surface);
	if (problem) throw new AiError("ai_invalid_input", problem);
	return parsed.data;
}

/** 화면 기능을 만든다. 지시문은 처음 문구로 두고 관리자 화면에서 바로 고친다. */
export async function createCustomAction(store: AiActionsStore, baseInput: unknown): Promise<AiActionView> {
	const base = readBase(baseInput);
	const key = newCustomKey();
	const value: CustomValue = { base, override: {} };
	const row = await store.saveAiCustomAction({ key, expectedVersion: 0, value });
	return viewOf(resolveAction(key, customDefinition(base), {}), row, value);
}

/** 화면 기능을 지운다. */
export async function deleteCustomAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<void> {
	if (!isCustomKey(key)) throw new AiError("ai_invalid_input", "코드로 정한 기능은 지울 수 없습니다.");
	await store.deleteAiCustomAction({ key, expectedVersion });
}

/**
 * 고친 값을 저장한다. 기본값과 같은 값은 저장하지 않는다.
 * 화면 기능은 기본 정보(`base`: 이름·붙을 곳·결과 모양)도 함께 고칠 수 있다.
 */
export async function updateAction(
	store: AiActionsStore,
	key: string,
	expectedVersion: number,
	edited: unknown,
	baseInput?: unknown,
): Promise<AiActionView> {
	if (isCustomKey(key)) {
		const { value: current } = await customRow(store, key);
		const base = baseInput === undefined ? current.base : readBase(baseInput);
		const definition = customDefinition(base);
		const action = actionWithEdits(key, edited, definition);
		const value: CustomValue = { base, override: overrideFrom(definition, action) };
		const row = await store.saveAiCustomAction({ key, expectedVersion, value });
		return viewOf(resolveAction(key, definition, value.override), row, value);
	}
	const action = actionWithEdits(key, edited);
	const definition = definitionOf(key);
	const value = overrideFrom(definition, action);
	const row = await store.saveAiActionOverride({ key, expectedVersion, value });
	return viewOf(action, row);
}

/** 기본값으로 되돌린다. 켜짐 여부는 지금 값을 둔다. 화면 기능은 되돌릴 기본값이 없다. */
export async function resetAction(store: AiActionsStore, key: string, expectedVersion: number): Promise<AiActionView> {
	if (isCustomKey(key)) throw new AiError("ai_invalid_input", "직접 만든 기능은 되돌릴 기본값이 없습니다.");
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
