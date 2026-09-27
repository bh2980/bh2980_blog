import { defineBlock } from "./define";

/**
 * 이 블로그 본문의 블록 정의(v2 B3). 저장 문법 표(§4.4)의 단일 원천이다.
 * 블록을 더하거나 바꾸면 `CMS-SPEC.md` §4.4와 공개 렌더러·에디터 등록부를 함께 확인한다(정의 테스트가 누락을 잡는다).
 */

const ALIGN_OPTIONS = { left: "왼쪽", center: "가운데", right: "오른쪽" } as const;
const ROTATE_OPTIONS = { "0": "0°", "90": "90°", "180": "180°", "270": "270°" } as const;

export const callout = defineBlock({
	name: "callout",
	label: "콜아웃",
	description: "참고·경고처럼 눈에 띄게 강조하는 상자",
	syntax: { kind: "container", directive: "callout" },
	component: "Callout",
	attributes: {
		variant: {
			type: "string",
			label: "종류",
			options: { note: "노트", tip: "팁", info: "정보", warning: "경고", danger: "위험" },
			defaultValue: "note",
		},
		title: { type: "string", label: "제목" },
		description: { type: "string", label: "설명", input: "textarea" },
	},
	editor: { view: "node", nodeView: "callout", insertable: true, keywords: ["callout", "콜아웃", "알림"] },
});

export const collapsible = defineBlock({
	name: "collapsible",
	label: "접기",
	description: "제목을 눌러 펼치는 영역",
	syntax: { kind: "container", directive: "collapsible" },
	component: "Collapsible",
	attributes: {
		title: { type: "string", label: "제목" },
		defaultOpen: { type: "boolean", label: "처음부터 펼치기", defaultValue: false },
	},
	editor: { view: "node", nodeView: "collapsible", insertable: true, keywords: ["collapsible", "접기", "펼치기"] },
});

export const textAlign = defineBlock({
	name: "text-align",
	label: "정렬",
	syntax: { kind: "container", directive: "text-align" },
	component: "TextAlign",
	// §4.4 A4: `justify`는 쓰지 않는다. 공개 렌더가 세 값만 고정 클래스로 지원한다.
	attributes: { align: { type: "string", label: "정렬", required: true, options: ALIGN_OPTIONS } },
	editor: { view: "attribute" },
});

export const tabs = defineBlock({
	name: "tabs",
	label: "탭",
	description: "여러 내용을 탭으로 나눠 보여 준다",
	syntax: { kind: "container", directive: "tabs" },
	component: "Tabs",
	attributes: {
		defaultValue: { type: "string", label: "처음 열 탭", description: "탭 이름 중 하나. 비우면 첫 탭이다." },
	},
	children: { blocks: ["tab"], min: 2, max: 8 },
	editor: { view: "node", nodeView: "tabs", insertable: true, keywords: ["tabs", "탭"] },
});

export const tab = defineBlock({
	name: "tab",
	label: "탭 하나",
	syntax: { kind: "container", directive: "tab" },
	component: "Tab",
	attributes: { label: { type: "string", label: "탭 이름", required: true } },
	parent: "tabs",
	editor: { view: "node", nodeView: "tab" },
});

export const columns = defineBlock({
	name: "columns",
	label: "단 나누기",
	description: "내용을 2~4단으로 나란히 놓는다",
	syntax: { kind: "container", directive: "columns" },
	component: "Columns",
	attributes: {},
	children: { blocks: ["column"], min: 2, max: 4 },
	editor: { view: "node", nodeView: "columns", insertable: true, keywords: ["columns", "단", "나란히"] },
});

export const column = defineBlock({
	name: "column",
	label: "단 하나",
	syntax: { kind: "container", directive: "column" },
	component: "Column",
	attributes: {},
	parent: "columns",
	editor: { view: "node", nodeView: "column" },
});

export const image = defineBlock({
	name: "image",
	label: "이미지",
	syntax: { kind: "leaf", directive: "image" },
	component: "Image",
	attributes: {
		mediaId: { type: "string", label: "미디어", description: "등록 미디어. 외부 주소(src)와 둘 중 하나를 쓴다." },
		src: { type: "string", label: "외부 주소" },
		alt: { type: "string", label: "대체 텍스트", description: "등록 미디어는 장식 이미지가 아니면 발행 전에 채운다." },
		width: { type: "string", label: "너비", description: "px 또는 %" },
		align: { type: "string", label: "정렬", options: ALIGN_OPTIONS },
		caption: { type: "string", label: "캡션" },
		decorative: { type: "boolean", label: "장식 이미지", defaultValue: false },
		crop: { type: "string", label: "자르기", description: "x,y,w,h (원본 기준 백분율 0~100)" },
		rotate: { type: "string", label: "회전", options: ROTATE_OPTIONS, description: "90|180|270 (시계 방향)" },
		title: { type: "string", label: "타이틀", description: "이미지 타이틀" },
	},
	editor: { view: "node", nodeView: "image", insertable: true, keywords: ["image", "이미지", "사진"] },
});

export const tooltip = defineBlock({
	name: "tooltip",
	label: "툴팁",
	syntax: { kind: "text", directive: "tooltip" },
	component: "Tooltip",
	attributes: { content: { type: "string", label: "설명", required: true } },
	editor: { view: "mark" },
});

const textMark = (name: "u" | "sup" | "sub" | "br", label: string) =>
	defineBlock({
		name,
		label,
		syntax: { kind: "text", directive: name },
		component: name,
		attributes: {},
		editor: { view: "mark" },
	});

export const underline = textMark("u", "밑줄");
export const superscript = textMark("sup", "위 첨자");
export const subscript = textMark("sub", "아래 첨자");
export const lineBreak = textMark("br", "줄바꿈");

export const mermaid = defineBlock({
	name: "mermaid",
	label: "다이어그램(Mermaid)",
	syntax: { kind: "fence", lang: "mermaid" },
	component: "Mermaid",
	attributes: {},
	editor: { view: "node", nodeView: "mermaid", insertable: true, keywords: ["mermaid", "다이어그램", "흐름도"] },
});

export const chart = defineBlock({
	name: "chart",
	label: "차트",
	syntax: { kind: "fence", lang: "chart" },
	component: "Chart",
	attributes: {},
	editor: { view: "node", nodeView: "chart", insertable: true, keywords: ["chart", "차트", "그래프"] },
});

export const math = defineBlock({
	name: "math",
	label: "수식",
	syntax: { kind: "math" },
	component: "Math",
	renderedBy: "rehype-katex",
	attributes: {},
	editor: { view: "node", nodeView: "math", insertable: true, keywords: ["math", "수식", "katex"] },
});

export const table = defineBlock({
	name: "table",
	label: "표",
	description: "셀 병합이나 열 너비가 있는 표",
	syntax: { kind: "container", directive: "table" },
	component: "Table",
	attributes: {
		align: { type: "string", label: "열 정렬", description: "left, center, right 쉼표 구분" },
		widths: { type: "string", label: "열 너비", description: "px 정수 쉼표 구분(비우면 자동)" },
	},
	children: { blocks: ["row"], min: 1 },
	editor: { view: "opaque", insertable: false, keywords: ["table", "표"] },
});

export const row = defineBlock({
	name: "row",
	label: "행",
	syntax: { kind: "container", directive: "row" },
	component: "TableRow",
	attributes: {},
	children: { blocks: ["cell"], min: 1 },
	parent: "table",
	editor: { view: "opaque" },
});

export const cell = defineBlock({
	name: "cell",
	label: "셀",
	syntax: { kind: "leaf", directive: "cell" },
	component: "TableCell",
	attributes: {
		colspan: { type: "string", label: "열 병합" },
		rowspan: { type: "string", label: "행 병합" },
		header: { type: "boolean", label: "머리글", defaultValue: false },
	},
	parent: "row",
	editor: { view: "opaque" },
});

/** 선언 순서가 `/meta`와 문서의 순서다. */
export const BLOCKS = [
	callout,
	collapsible,
	textAlign,
	tabs,
	tab,
	columns,
	column,
	image,
	tooltip,
	underline,
	superscript,
	subscript,
	lineBreak,
	mermaid,
	chart,
	math,
	table,
	row,
	cell,
] as const;
