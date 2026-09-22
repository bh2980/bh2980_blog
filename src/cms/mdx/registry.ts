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

export const TABS_MIN = 2;
export const TABS_MAX = 8;
export const COLUMNS_MIN = 2;
export const COLUMNS_MAX = 4;

/** 배치 4에서 제거한 이름. 본문에 남아 있으면 `analyze`가 거부한다(읽기 호환도 끝). */
export const RETIRED_JSX_NAMES = new Set(["ContentLink", "IdeographicSpace"]);

/** 이벤트 핸들러 속성 이름. React는 대소문자를 보존하지 않으므로 `onerror`도 막는다(M7-SEC-1 P2). */
export const EVENT_HANDLER_NAME = /^on[a-z]/i;
