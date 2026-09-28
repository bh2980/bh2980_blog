import type { Editor } from "@tiptap/core";
import type { Mark, ResolvedPos } from "@tiptap/pm/model";
import { type EditorState, TextSelection } from "@tiptap/pm/state";
import { Bold, CodeXml, Italic, Strikethrough, Subscript, Superscript, Underline } from "lucide-react";
import { selectedBlocks } from "./drag";
import type { ToolbarItem } from "./toolbar-button";

export interface InlineMarkTool extends ToolbarItem {
	/** 이 도구가 켜고 끄는 마크 이름. */
	mark: string;
}

const chain = (editor: Editor) => editor.chain().focus();

/** 켜고 끄기만 하는 인라인 효과. 상단 서식 도구와 인라인 버블이 함께 쓴다. */
const MARK_TOOLS: Omit<InlineMarkTool, "isActive">[] = [
	{ mark: "bold", label: "B", title: "굵게", icon: Bold, run: (e) => chain(e).toggleBold().run() },
	{ mark: "italic", label: "i", title: "기울임", icon: Italic, run: (e) => chain(e).toggleItalic().run() },
	{ mark: "strike", label: "S", title: "취소선", icon: Strikethrough, run: (e) => chain(e).toggleStrike().run() },
	{ mark: "code", label: "</>", title: "인라인 코드", icon: CodeXml, run: (e) => chain(e).toggleCode().run() },
	{ mark: "underline", label: "U", title: "밑줄", icon: Underline, run: (e) => chain(e).toggleUnderline().run() },
	{
		mark: "superscript",
		label: "x²",
		title: "위첨자",
		icon: Superscript,
		run: (e) => chain(e).toggleSuperscript().run(),
	},
	{ mark: "subscript", label: "x₂", title: "아래첨자", icon: Subscript, run: (e) => chain(e).toggleSubscript().run() },
];

export const INLINE_MARK_TOOLS: InlineMarkTool[] = MARK_TOOLS.map((item) => ({
	...item,
	isActive: (e: Editor) => e.isActive(item.mark),
}));

/** 커서를 두면 버블에 보여 줄 마크. 설정이 있는 마크(링크·툴팁)를 먼저 보인다. */
const BUBBLE_MARK_ORDER = ["link", "cmsTooltip", ...INLINE_MARK_TOOLS.map((tool) => tool.mark)];

/** 커서가 걸친 마크 하나와 그 마크가 이어지는 범위. */
export interface ActiveInlineMark {
	name: string;
	from: number;
	to: number;
	attrs: Record<string, unknown>;
}

export type InlineBubbleTarget =
	| { kind: "selection"; from: number; to: number }
	| { kind: "marks"; pos: number; marks: ActiveInlineMark[] };

/** `$pos` 바로 앞(before) 또는 뒤(after) 글자에서 시작해 같은 마크가 이어지는 범위. */
function markRange($pos: ResolvedPos, mark: Mark, side: "before" | "after"): { from: number; to: number } {
	const parent = $pos.parent;
	const index = side === "after" || $pos.textOffset > 0 ? $pos.index() : $pos.index() - 1;
	let first = index;
	let last = index;
	while (first > 0 && mark.isInSet(parent.child(first - 1).marks)) first -= 1;
	while (last < parent.childCount - 1 && mark.isInSet(parent.child(last + 1).marks)) last += 1;
	let from = $pos.start();
	for (let i = 0; i < first; i += 1) from += parent.child(i).nodeSize;
	let to = from;
	for (let i = first; i <= last; i += 1) to += parent.child(i).nodeSize;
	return { from, to };
}

/**
 * 인라인 버블을 띄울 대상.
 * - 글자를 고르면(`selection`) 효과를 적용하는 도구를 띄운다.
 * - 커서가 효과 안이나 끝에 있으면(`marks`) 걸친 효과와 그 범위를 돌려준다(삭제·설정 수정용).
 * 코드 블록 안, 블록(마키) 선택, 셀 선택, 노드 선택에는 띄우지 않는다.
 */
export function inlineBubbleTarget(state: EditorState): InlineBubbleTarget | null {
	const { selection } = state;
	if (!(selection instanceof TextSelection) || selectedBlocks(state)) return null;
	const { $from, $to, from, to } = selection;
	if ($from.parent.type.spec.code || $to.parent.type.spec.code) return null;
	if (!selection.empty) return state.doc.textBetween(from, to, " ").trim() ? { kind: "selection", from, to } : null;

	const marks: ActiveInlineMark[] = [];
	for (const side of ["after", "before"] as const) {
		const node = side === "after" ? $from.nodeAfter : $from.nodeBefore;
		for (const mark of node?.marks ?? []) {
			if (!BUBBLE_MARK_ORDER.includes(mark.type.name) || marks.some((item) => item.name === mark.type.name)) continue;
			marks.push({ name: mark.type.name, attrs: mark.attrs, ...markRange($from, mark, side) });
		}
	}
	if (!marks.length) return null;
	marks.sort((a, b) => BUBBLE_MARK_ORDER.indexOf(a.name) - BUBBLE_MARK_ORDER.indexOf(b.name));
	return { kind: "marks", pos: from, marks };
}

/** 효과 하나를 그 범위 전체에서 지운다. 커서는 그 자리에 둔다. */
export function removeInlineMark(editor: Editor, mark: ActiveInlineMark): boolean {
	const type = editor.schema.marks[mark.name];
	if (!type) return false;
	return editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.removeMark(mark.from, mark.to, type);
			return true;
		})
		.run();
}
