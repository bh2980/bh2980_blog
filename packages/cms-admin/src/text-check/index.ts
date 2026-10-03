/**
 * 맞춤법·문장 검사 도구(`@bh2980/cms-admin/text-check`). 본체 편집기는 검사기를 모른다. 확장이 검사기를 만들어
 * `textCheckExtension({ checkers })`(`@bh2980/cms-admin/text-check/extension`)를 관리자 확장(`editorExtensions`)에 넣으면
 * 검사기마다 도구 모음 버튼이 생긴다. 이 진입점은 화면 코드를 싣지 않아 사이트 설정·서버에서도 불러도 된다.
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
