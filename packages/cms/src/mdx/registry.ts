import { ADDED_BLOCKS } from "../blocks/active";

/** 더한 블록(블록 확장·사이트 설정)의 공개 렌더러 이름. */
const ADDED_COMPONENTS = ADDED_BLOCKS.map((block) => block.component);

export const REGISTERED_JSX_NAMES = new Set([
	"Tooltip",
	"CodeRef",
	"Color",
	"Untranslated",
	"u",
	"strong",
	"em",
	"del",
	"sup",
	"sub",
	"br",
	"TextAlign",
	"Image",
	"File",
	"CodeBlock",
	"Math",
	"Table",
	"TableRow",
	"TableCell",
	...ADDED_COMPONENTS,
]);

export const BLOCK_JSX_NAMES = new Set([
	"TextAlign",
	"Image",
	"File",
	"CodeBlock",
	"Math",
	"Table",
	"TableRow",
	"TableCell",
	...ADDED_COMPONENTS,
]);

export const INLINE_JSX_MARKS: Record<string, string> = {
	u: "underline",
	strong: "bold",
	em: "italic",
	del: "strike",
	sup: "superscript",
	sub: "subscript",
	Tooltip: "tooltip",
	CodeRef: "codeRef",
	Color: "color",
	Untranslated: "untranslated",
};

/**
 * mark 정렬 순서. 파서(`to-document`)·직렬화(`serialize`)·에디터 변환(`tiptap-content`)이 같은 순서를 써야
 * 왕복 문서 비교가 순서 때문에 깨지지 않는다.
 */
export const MARK_ORDER = [
	"untranslated",
	"tooltip",
	"codeRef",
	"color",
	"underline",
	"superscript",
	"subscript",
	"link",
	"bold",
	"italic",
	"strike",
	"code",
];

export const sortMarks = <T extends { type: string }>(marks: readonly T[]): T[] =>
	[...marks].sort((left, right) => MARK_ORDER.indexOf(left.type) - MARK_ORDER.indexOf(right.type));

/** 배치 4에서 제거한 이름. 본문에 남아 있으면 `analyze`가 거부한다(읽기 호환도 끝). */
export const RETIRED_JSX_NAMES = new Set(["ContentLink", "IdeographicSpace"]);

/** 이벤트 핸들러 속성 이름. React는 대소문자를 보존하지 않으므로 `onerror`도 막는다(M7-SEC-1 P2). */
export const EVENT_HANDLER_NAME = /^on[a-z]/i;
