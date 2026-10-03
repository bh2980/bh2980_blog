/**
 * 맞춤법·문장 검사 확장(`@bh2980/cms-admin/text-check`). 본체는 검사기를 넣지 않는다. 사이트가 만든 검사기를
 * 관리자 컴포넌트의 `textCheckers`에 등록하면 편집기 도구 모음에 "맞춤법 검사" 버튼이 생긴다.
 * 서버 경로 도우미는 `@bh2980/cms-admin/text-check/server`에 있다.
 */

export { type DocSegment, extractSegments, PLACEHOLDER, segmentRangeToDoc } from "./extract";
export { type RemoteTextCheckerOptions, remoteTextChecker } from "./remote";
export {
	defineTextChecker,
	supportsLocale,
	type TextCheckContext,
	type TextChecker,
	type TextCheckerLimits,
	type TextCheckerOptions,
	type TextCheckSegment,
	type TextIssue,
	type TextIssueCategory,
	type TextIssueSeverity,
} from "./types";
