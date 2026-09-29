import type { Editor, Range } from "@tiptap/core";
import type { BlockDefinition } from "../blocks/define";
import { BLOCKS } from "../blocks/definitions";
import { BLOCK_INSERT_ACTIONS, type BlockInsertAction, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";
import { OPEN_TOOLTIP_EVENT } from "./tooltip-popover";

export { OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";
export { OPEN_TOOLTIP_EVENT } from "./tooltip-popover";

export interface SlashCommandItem {
	/** 블록 삽입 항목의 nodeView 이름. 기본 서식 항목에는 없다. */
	id?: string;
	title: string;
	description: string;
	keywords: string[];
	action: (editor: Editor, range: Range) => void;
}

const heading = (level: 2 | 3 | 4, description: string, extra: string[]): SlashCommandItem => ({
	title: `제목 ${level} (H${level})`,
	description,
	keywords: ["제목", `h${level}`, `heading${level}`, ...extra],
	action: (editor, range) => {
		editor.chain().focus().deleteRange(range).toggleHeading({ level }).run();
	},
});

/**
 * 기본 서식 및 인라인 슬래시 커맨드.
 */
export const BASE_SLASH_COMMANDS: SlashCommandItem[] = [
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
	{
		title: "툴팁 (Tooltip)",
		description: "선택한 텍스트에 부가 설명 추가 (텍스트 선택 필요)",
		keywords: ["툴팁", "tooltip", "설명", "주석"],
		action: (editor, range) => {
			// 슬래시는 빈 문단에서 입력하므로 선택 영역이 없다. 라벨 예시를 선택해 편집·설명 입력을 시작한다.
			editor.chain().focus().deleteRange(range).insertContent("툴팁 텍스트").run();
			const to = editor.state.selection.from;
			editor.commands.setTextSelection({ from: to - "툴팁 텍스트".length, to });
			window.dispatchEvent(new CustomEvent(OPEN_TOOLTIP_EVENT));
		},
	},
];

const DEFAULT_BLOCK_DESCRIPTIONS: Record<string, string> = {
	mermaid: "다이어그램·흐름도 삽입",
	chart: "차트·그래프 삽입",
	math: "LaTeX 수식 삽입",
};

/**
 * 블록 정의(BLOCKS) 중 `editor.insertable === true`이고 `editor.view === 'node'`인 것 중
 * 삽입 액션이 등록된 블록에 대한 슬래시 커맨드 목록을 생성한다(v2 C3a).
 */
export function buildBlockSlashCommands(
	definitions: readonly BlockDefinition[] = BLOCKS,
	actions: Record<string, BlockInsertAction> = BLOCK_INSERT_ACTIONS,
): SlashCommandItem[] {
	const items: SlashCommandItem[] = [];
	for (const block of definitions) {
		if (block.editor.insertable !== true || block.editor.view !== "node") continue;
		const nodeView = block.editor.nodeView;
		if (!nodeView) continue;
		// 이미지는 기존 하드코딩 항목이 있으므로 중복 제외
		if (nodeView === "image" || block.name === "image") continue;
		const action = actions[nodeView];
		if (!action) continue;

		items.push({
			id: nodeView,
			title: block.label,
			description: block.description ?? DEFAULT_BLOCK_DESCRIPTIONS[nodeView] ?? `${block.label} 삽입`,
			keywords: block.editor.keywords ? [...block.editor.keywords] : [block.label, block.name],
			action,
		});
	}
	return items;
}

/**
 * `/` 블록 삽입 메뉴(§4.2). 한국어·영문 이름으로 검색한다.
 * 글 제목이 본문 위의 H1이므로 본문 제목은 H2부터 쓴다(§4.1).
 */
export const SLASH_COMMANDS: SlashCommandItem[] = [...BASE_SLASH_COMMANDS, ...buildBlockSlashCommands()];

export function filterCommands(query: string): SlashCommandItem[] {
	if (!query) return SLASH_COMMANDS;
	const clean = query.trim().toLowerCase();
	return SLASH_COMMANDS.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
