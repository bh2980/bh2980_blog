import type { CmsPlugin, PluginNamed } from "@bh2980/cms";
import { cmsConfig, type ResolvedConfig } from "@bh2980/cms/client";
import type { AiActionDefinition, AiActionInput, AiActionResult, AiAttach, AiConfig } from "./action";
import type { AiSlot } from "./definition";
import { AI_PLUGIN_NAME } from "./plugin-name";

/**
 * 사이트 설정의 AI 기능(`aiPlugin({ actions })`). 기능 이름(key)과 입력·결과 타입을 설정에서 뽑는다.
 * 서버(실행)와 브라우저(자리·이름으로 부르기)가 함께 읽는다.
 */

type AiPluginOptions = ResolvedConfig extends { readonly plugins?: infer P }
	? PluginNamed<P, typeof AI_PLUGIN_NAME> extends CmsPlugin<string, infer O>
		? O
		: never
	: never;
type ConfigActions = [AiPluginOptions] extends [{ readonly actions: infer X }] ? X : Record<never, never>;

/** 설정에 있는 기능 이름. */
export type AiActionKey = keyof ConfigActions & string;
/** 기능을 부를 때 줄 입력. */
export type AiActionInputOf<K extends AiActionKey> = AiActionInput<ConfigActions[K]>;
/** 기능의 결과. */
export type AiActionResultOf<K extends AiActionKey> = AiActionResult<ConfigActions[K]>;

/** 사이트 설정에 등록한 AI 플러그인의 설정. 등록하지 않았으면 `undefined`. */
const aiConfig = cmsConfig.plugins?.find((plugin) => plugin.name === AI_PLUGIN_NAME)?.options as AiConfig | undefined;

export const AI_ACTIONS: Readonly<Record<string, AiActionDefinition>> = aiConfig?.actions ?? {};

/** 모든 기능 맨 앞 지시에 들어가는 사이트 소개. */
export const AI_SITE_DESCRIPTION = aiConfig?.siteDescription?.trim() || "블로그";

export const actionDefinition = (key: string): AiActionDefinition | undefined =>
	Object.hasOwn(AI_ACTIONS, key) ? AI_ACTIONS[key] : undefined;

/** 화면 자리가 찾는 곳. 필드 자리는 필드 이름과 컬렉션, 나머지는 자리 안 대상이다. */
export interface AiPlace {
	readonly slot: AiSlot;
	readonly target?: string;
	readonly collection?: string;
}

/** 자리에 붙은 기능인가. */
export function attachedTo(attach: AiAttach, place: AiPlace): boolean {
	if (attach.slot !== place.slot) return false;
	switch (attach.slot) {
		case "field":
			return (
				attach.field === place.target &&
				(!attach.collections || (place.collection !== undefined && attach.collections.includes(place.collection)))
			);
		case "translation":
			return true;
		default:
			return attach.target === place.target;
	}
}
