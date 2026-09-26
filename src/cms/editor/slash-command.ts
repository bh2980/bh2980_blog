import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandItem {
	title: string;
	description: string;
	keywords: string[];
	action: (editor: Editor, range: Range) => void;
}

/** 이미지 삽입 대화상자를 여는 이벤트. 편집기 컴포넌트가 듣는다. */
export const OPEN_IMAGE_DIALOG_EVENT = "cms:open-image-dialog";

const heading = (level: 2 | 3 | 4, description: string, extra: string[]): SlashCommandItem => ({
	title: `제목 ${level} (H${level})`,
	description,
	keywords: ["제목", `h${level}`, `heading${level}`, ...extra],
	action: (editor, range) => {
		editor.chain().focus().deleteRange(range).toggleHeading({ level }).run();
	},
});

/**
 * `/` 블록 삽입 메뉴(§4.2). 한국어·영문 이름으로 검색한다.
 * 글 제목이 본문 위의 H1이므로 본문 제목은 H2부터 쓴다(§4.1).
 */
export const SLASH_COMMANDS: SlashCommandItem[] = [
	{
		title: "문단 (Paragraph)",
		description: "일반 텍스트 본문",
		keywords: ["본문", "텍스트", "문단", "paragraph", "p"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setParagraph().run();
		},
	},
	heading(2, "큰 섹션 제목", ["대제목"]),
	heading(3, "중간 섹션 제목", ["중제목"]),
	heading(4, "소제목", ["소제목"]),
	{
		title: "글머리 기호 목록",
		description: "순서 없는 불릿 리스트",
		keywords: ["목록", "불릿", "리스트", "bullet", "list", "ul"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: "번호 매기기 목록",
		description: "순서가 있는 숫자 리스트",
		keywords: ["순서", "번호", "목록", "ordered", "numbered", "list", "ol"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: "체크 목록 (To-do)",
		description: "완료 여부를 표시하는 목록",
		keywords: ["체크", "할일", "할 일", "목록", "todo", "task", "checklist"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},
	{
		title: "인용구 (Quote)",
		description: "강조하고 싶은 인용 문구",
		keywords: ["인용", "인용구", "quote", "blockquote"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		title: "코드 블록 (Code Block)",
		description: "프로그래밍 코드 삽입",
		keywords: ["코드", "코드블록", "code", "pre"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: "표 (Table)",
		description: "3×3 표 삽입. 행·열은 표 도구로 추가·삭제",
		keywords: ["표", "테이블", "table", "grid"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
		},
	},
	{
		title: "구분선 (Divider)",
		description: "가로 구분선",
		keywords: ["구분선", "가로줄", "선", "divider", "hr"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: "이미지 (Image)",
		description: "새로 업로드하거나 라이브러리에서 고르기",
		keywords: ["이미지", "사진", "그림", "라이브러리", "image", "img", "photo", "media"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run();
			window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
		},
	},
	{
		title: "내부 글 링크",
		description: "제목으로 글·메모를 찾아 링크 (`[[`로도 열림)",
		keywords: ["링크", "내부", "글", "link", "internal"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertContent("[[").run();
		},
	},
];

export function filterCommands(query: string): SlashCommandItem[] {
	if (!query) return SLASH_COMMANDS;
	const clean = query.trim().toLowerCase();
	return SLASH_COMMANDS.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
