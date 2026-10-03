import { defineBlock } from "./define";

/**
 * 본체 블록 정의(v2 B3). 다른 기능이 기대거나 Markdown 문법인 블록만 둔다. 콜아웃·탭 같은 블록과 툴팁·코드 연결·글자색 같은
 * 글자 꾸밈은 블록 확장(`@bh2980/cms-blocks`)이 플러그인으로 더하고, 사이트는 설정의 `blocks`로 더한다(`blocks/resolve.ts`).
 * 블록을 더하거나 바꾸면 공개 렌더러·에디터 등록부를 함께 확인한다(정의 테스트가 누락을 잡는다).
 */

const ALIGN_OPTIONS = { left: "왼쪽", center: "가운데", right: "오른쪽" } as const;
const ROTATE_OPTIONS = { "0": "0°", "90": "90°", "180": "180°", "270": "270°" } as const;

export const textAlign = defineBlock({
	name: "text-align",
	label: "정렬",
	syntax: { kind: "container", directive: "text-align" },
	component: "TextAlign",
	// §4.4 A4: `justify`는 쓰지 않는다. 공개 렌더가 세 값만 고정 클래스로 지원한다.
	attributes: { align: { type: "string", label: "정렬", required: true, options: ALIGN_OPTIONS } },
	translateInside: true,
	editor: { view: "attribute" },
});

export const image = defineBlock({
	name: "image",
	label: "이미지",
	syntax: { kind: "leaf", directive: "image" },
	component: "Image",
	attributes: {
		mediaId: { type: "string", label: "미디어", description: "등록 미디어. 외부 주소(src)와 둘 중 하나를 쓴다." },
		src: { type: "string", label: "외부 주소" },
		alt: {
			type: "string",
			label: "대체 텍스트",
			description: "등록 미디어는 장식 이미지가 아니면 발행 전에 채운다.",
			translatable: true,
		},
		width: { type: "string", label: "너비", description: "px 또는 %" },
		align: { type: "string", label: "정렬", options: ALIGN_OPTIONS },
		caption: { type: "string", label: "캡션", translatable: true },
		decorative: { type: "boolean", label: "장식 이미지", defaultValue: false },
		crop: { type: "string", label: "자르기", description: "x,y,w,h (원본 기준 백분율 0~100)" },
		rotate: { type: "string", label: "회전", options: ROTATE_OPTIONS, description: "90|180|270 (시계 방향)" },
		title: { type: "string", label: "타이틀", description: "이미지 타이틀", translatable: true },
	},
	editor: { view: "node", nodeView: "image", insertable: true, keywords: ["image", "이미지", "사진"] },
});

/**
 * 첨부 파일 카드(`::file{mediaId="…" label="보고서.pdf"}`, v3). 공개 화면은 이름·크기·형식과 내려받기를 보인다.
 * `label`을 비우면 올린 파일 이름을 쓴다.
 */
export const file = defineBlock({
	name: "file",
	label: "파일",
	syntax: { kind: "leaf", directive: "file" },
	component: "File",
	attributes: {
		mediaId: { type: "string", label: "미디어", required: true },
		label: { type: "string", label: "보일 이름", translatable: true },
	},
	editor: { view: "node", nodeView: "file", insertable: false, keywords: ["file", "파일", "첨부"] },
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

/**
 * 번역 안내 글(`:untranslated[원문 글]`, v3). 새 번역본은 원문 글을 이 표시로 감싸 둔다. 에디터는 흐리게 보이고
 * 그 블록에 입력하면 지운다. 공개 화면에는 보이지 않고, 남아 있으면 발행 전 검사가 알린다.
 */
export const untranslated = defineBlock({
	name: "untranslated",
	label: "번역 안내",
	syntax: { kind: "text", directive: "untranslated" },
	component: "Untranslated",
	attributes: {},
	editor: { view: "mark" },
});

export const underline = textMark("u", "밑줄");
export const superscript = textMark("sup", "위 첨자");
export const subscript = textMark("sub", "아래 첨자");
export const lineBreak = textMark("br", "줄바꿈");

export const math = defineBlock({
	name: "math",
	label: "수식",
	syntax: { kind: "math" },
	component: "Math",
	renderedBy: "rehype-katex",
	attributes: {},
	description: "LaTeX 수식",
	editor: { view: "node", nodeView: "math", insertable: true, keywords: ["math", "수식", "katex"], icon: "sigma" },
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

/** 본체 블록. 선언 순서가 `/meta`와 문서의 순서다. 사이트가 쓰는 블록은 `blocks/active.ts`의 `BLOCKS`다. */
export const BUILTIN_BLOCKS = [
	textAlign,
	image,
	file,
	untranslated,
	underline,
	superscript,
	subscript,
	lineBreak,
	math,
	table,
	row,
	cell,
] as const;
