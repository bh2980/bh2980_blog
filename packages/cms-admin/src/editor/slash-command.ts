import type { BlockDefinition } from "@bh2980/cms/client";
import { ADDED_BLOCKS, BLOCKS } from "@bh2980/cms/client";
import type { Editor, Range } from "@tiptap/core";
import {
	Heading2,
	Heading3,
	Heading4,
	Image,
	Link2,
	List,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	MessageSquareText,
	Minus,
	Pilcrow,
	Quote,
	SquareCode,
	Table2,
} from "lucide-react";
import { BLOCK_INSERT_ACTIONS, type BlockInsertAction, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";
import { OPEN_TOOLTIP_EVENT } from "./tooltip-popover";

export { OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";
export { OPEN_TOOLTIP_EVENT } from "./tooltip-popover";

export interface SlashCommandItem {
	/** 블록 삽입 항목의 이름(본체 블록은 nodeView, 더한 블록은 블록 이름). 기본 서식 항목에는 없다. */
	id?: string;
	/** 아이콘. 블록 삽입 항목은 블록 정의의 `editor.icon`(lucide 이름)이다. 없으면 퍼즐 아이콘이다. */
	icon?: LucideIcon | string;
	title: string;
	description: string;
	keywords: string[];
	action: (editor: Editor, range: Range) => void;
}

const HEADING_ICONS = { 2: Heading2, 3: Heading3, 4: Heading4 } as const;

const heading = (level: 2 | 3 | 4, description: string, extra: string[]): SlashCommandItem => ({
	title: `제목 ${level}`,
	icon: HEADING_ICONS[level],
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
		title: "문단",
		description: "일반 본문",
		icon: Pilcrow,
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
		description: "순서 없는 목록",
		icon: List,
		keywords: ["목록", "불릿", "리스트", "bullet", "list", "ul"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: "번호 매기기 목록",
		description: "순서 있는 목록",
		icon: ListOrdered,
		keywords: ["순서", "번호", "목록", "ordered", "numbered", "list", "ol"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: "체크 목록",
		description: "할 일 목록",
		icon: ListTodo,
		keywords: ["체크", "할일", "할 일", "목록", "todo", "task", "checklist"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},
	{
		title: "인용구",
		description: "인용 문구",
		icon: Quote,
		keywords: ["인용", "인용구", "quote", "blockquote"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		title: "코드 블록",
		description: "프로그래밍 코드",
		icon: SquareCode,
		keywords: ["코드", "코드블록", "code", "pre"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: "표",
		description: "3×3 표",
		icon: Table2,
		keywords: ["표", "테이블", "table", "grid"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
		},
	},
	{
		title: "구분선",
		description: "가로 구분선",
		icon: Minus,
		keywords: ["구분선", "가로줄", "선", "divider", "hr"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: "이미지",
		description: "올리거나 라이브러리에서 고르기",
		icon: Image,
		keywords: ["이미지", "사진", "그림", "라이브러리", "image", "img", "photo", "media"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run();
			window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
		},
	},
	{
		title: "내부 글 링크",
		description: "제목으로 글·메모 찾기",
		icon: Link2,
		keywords: ["링크", "내부", "글", "link", "internal"],
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertContent("[[").run();
		},
	},
	{
		title: "툴팁",
		description: "글자에 설명 달기",
		icon: MessageSquareText,
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

/** 슬래시 메뉴 블록 순서: 더한 블록(블록 확장·사이트 설정) 다음에 본체 블록(수식 등)이다. */
const MENU_BLOCKS: readonly BlockDefinition[] = [
	...ADDED_BLOCKS,
	...BLOCKS.filter((block) => !ADDED_BLOCKS.includes(block)),
];

/**
 * 블록 정의(BLOCKS) 중 `editor.insertable === true`이고 `editor.view === 'node'`인 것 중
 * 삽입 액션이 등록된 블록에 대한 슬래시 커맨드 목록을 생성한다(v2 C3a).
 */
export function buildBlockSlashCommands(
	definitions: readonly BlockDefinition[] = MENU_BLOCKS,
	actions: Record<string, BlockInsertAction> = BLOCK_INSERT_ACTIONS,
): SlashCommandItem[] {
	const items: SlashCommandItem[] = [];
	for (const block of definitions) {
		if (block.editor.insertable !== true || block.editor.view !== "node") continue;
		// 더한 블록은 편집기 이름이 없어 블록 이름으로 삽입 동작을 찾는다.
		const nodeView = block.editor.nodeView ?? block.name;
		// 이미지는 기존 하드코딩 항목이 있으므로 중복 제외
		if (nodeView === "image" || block.name === "image") continue;
		const action = actions[nodeView];
		if (!action) continue;

		items.push({
			id: nodeView,
			title: block.label,
			description: block.description ?? `${block.label} 삽입`,
			keywords: block.editor.keywords ? [...block.editor.keywords] : [block.label, block.name],
			...(block.editor.icon ? { icon: block.editor.icon } : {}),
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

/** 슬래시 메뉴 항목. `extra`는 편집 화면 확장(플러그인)이 더한 항목이다(뒤에 붙는다). */
export function filterCommands(query: string, extra: readonly SlashCommandItem[] = []): SlashCommandItem[] {
	const commands = extra.length > 0 ? [...SLASH_COMMANDS, ...extra] : SLASH_COMMANDS;
	if (!query) return commands;
	const clean = query.trim().toLowerCase();
	return commands.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
