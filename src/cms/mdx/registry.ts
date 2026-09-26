export const REGISTERED_JSX_NAMES = new Set([
	"Callout",
	"Collapsible",
	"Columns",
	"Column",
	"Tabs",
	"Tab",
	"Tooltip",
	"u",
	"strong",
	"em",
	"del",
	"sup",
	"sub",
	"br",
	"TextAlign",
	"Image",
	"Chart",
	"Mermaid",
	"CodeBlock",
	"Math",
]);

export const BLOCK_JSX_NAMES = new Set([
	"Callout",
	"Collapsible",
	"Columns",
	"Column",
	"Tabs",
	"Tab",
	"TextAlign",
	"Image",
	"Chart",
	"Mermaid",
	"CodeBlock",
	"Math",
]);

export const INLINE_JSX_MARKS: Record<string, string> = {
	u: "underline",
	strong: "bold",
	em: "italic",
	del: "strike",
	sup: "superscript",
	sub: "subscript",
	Tooltip: "tooltip",
};

/**
 * mark 정렬 순서. 파서(`to-document`)·직렬화(`serialize`)·에디터 변환(`tiptap-content`)이 같은 순서를 써야
 * 왕복 문서 비교가 순서 때문에 깨지지 않는다.
 */
export const MARK_ORDER = [
	"tooltip",
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

export const TABS_MIN = 2;
export const TABS_MAX = 8;
export const COLUMNS_MIN = 2;
export const COLUMNS_MAX = 4;

/** 배치 4에서 제거한 이름. 본문에 남아 있으면 `analyze`가 거부한다(읽기 호환도 끝). */
export const RETIRED_JSX_NAMES = new Set(["ContentLink", "IdeographicSpace"]);

/** 이벤트 핸들러 속성 이름. React는 대소문자를 보존하지 않으므로 `onerror`도 막는다(M7-SEC-1 P2). */
export const EVENT_HANDLER_NAME = /^on[a-z]/i;
