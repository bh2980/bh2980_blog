import { z } from "zod";
import { AiError } from "./errors";
import { AI_SHARED } from "./registry";

/**
 * 공통 문구(M8-4). 정의는 플러그인 설정(`aiPlugin({ shared })`)에 있고, 관리자 화면에서 고친 문구만
 * AI 설정 표의 `shared` 줄에 둔다. 모든 기능의 지시문 `{{shared.이름}}`에 들어간다.
 */

export interface AiSharedStore {
	getAiSettings(id: "shared"): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { id: "shared"; expectedVersion: number; value: unknown }): Promise<number>;
}

export interface AiSharedView {
	version: number;
	items: { key: string; label: string; defaultText: string; text: string; overridden: boolean }[];
}

export const MAX_SHARED_TEXT = 4000;

const savedSchema = z.record(z.string(), z.string().max(MAX_SHARED_TEXT));
const updateSchema = z.object({ texts: z.record(z.string(), z.string().max(MAX_SHARED_TEXT)) });

async function load(store: AiSharedStore): Promise<{ version: number; saved: Record<string, string> }> {
	const row = await store.getAiSettings("shared");
	const parsed = savedSchema.safeParse(row?.value ?? {});
	return { version: row?.version ?? 0, saved: parsed.success ? parsed.data : {} };
}

const viewOf = (version: number, saved: Readonly<Record<string, string>>): AiSharedView => ({
	version,
	items: Object.entries(AI_SHARED).map(([key, definition]) => ({
		key,
		label: definition.label,
		defaultText: definition.text,
		text: saved[key] ?? definition.text,
		overridden: Object.hasOwn(saved, key),
	})),
});

/** 관리자 화면에 보일 공통 문구. */
export async function getSharedView(store: AiSharedStore): Promise<AiSharedView> {
	const { version, saved } = await load(store);
	return viewOf(version, saved);
}

/** 지시문에 넣을 공통 문구(고친 값을 얹은 것). */
export async function loadSharedTexts(store: AiSharedStore): Promise<Record<string, string>> {
	return Object.fromEntries((await getSharedView(store)).items.map((item) => [item.key, item.text]));
}

/** 공통 문구를 고친다. 기본값과 같은 문구는 저장하지 않는다(되돌리기). 정의에 없는 이름은 막는다. */
export async function updateShared(
	store: AiSharedStore,
	expectedVersion: number,
	input: unknown,
): Promise<AiSharedView> {
	const parsed = updateSchema.safeParse(input);
	if (!parsed.success) throw new AiError("ai_invalid_input", "공통 문구 형식이 맞지 않습니다.");
	const saved: Record<string, string> = {};
	for (const [key, text] of Object.entries(parsed.data.texts)) {
		const definition = AI_SHARED[key];
		if (!definition) throw new AiError("ai_invalid_input", `없는 공통 문구입니다: ${key}`);
		if (text !== definition.text) saved[key] = text;
	}
	const version = await store.saveAiSettings({ id: "shared", expectedVersion, value: saved });
	return viewOf(version, saved);
}
