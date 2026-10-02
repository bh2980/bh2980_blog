/**
 * 관리자 화면의 브라우저 쪽 진입점. 사이트가 관리자 화면에 컴포넌트를 넣거나(`CmsAdminComponentsProvider`)
 * 직접 만든 화면에서 AI 기능을 이름으로 부를 때(`useAiAction`) 쓴다.
 */
export {
	type CmsAdminComponents,
	CmsAdminComponentsProvider,
	useCmsAdminComponents,
} from "./admin-components";
export { type UseAiAction, useAiAction } from "./screens/ai/use-ai-action";
