/**
 * AI 플러그인 저작 API. 사이트 설정 파일(`cms.config.ts`)이 import하는 진입점이다. 서버·브라우저가 함께 읽으므로
 * 비밀 값이나 AI SDK를 넣지 않는다.
 */

export {
	type AiActionDefinition,
	type AiAttach,
	type AiChoices,
	type AiConfig,
	type AiInputSpec,
	aiAction,
	aiInput,
} from "./action";
export { aiPlugin } from "./plugin";
export { aiPresets } from "./presets";
