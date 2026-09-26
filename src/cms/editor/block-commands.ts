import { type Editor, Extension } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

/**
 * 최상위 블록 조작(§4.2): 위·아래 이동, 복제, 삭제. 블록 핸들 메뉴와 키보드 단축키가 같은 명령을 쓴다.
 * 문단과 커스텀 블록(원문 상자·이미지·표)을 같은 대상으로 다룬다.
 */

interface TopLevelBlock {
	index: number;
	start: number;
	end: number;
	node: PmNode;
}

/** 문서 위치가 속한 최상위 블록. */
export function topLevelBlockAt(doc: PmNode, pos: number): TopLevelBlock | null {
	if (doc.childCount === 0) return null;
	const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
	const index = Math.min($pos.index(0), doc.childCount - 1);
	let start = 0;
	for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
	const node = doc.child(index);
	return { index, start, end: start + node.nodeSize, node };
}

const selectionInside = (doc: PmNode, from: number) =>
	TextSelection.near(doc.resolve(Math.min(from + 1, doc.content.size)));

export function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
	const { state } = editor;
	const block = topLevelBlockAt(state.doc, pos);
	if (!block) return false;
	const neighborIndex = block.index + direction;
	if (neighborIndex < 0 || neighborIndex >= state.doc.childCount) return false;
	const neighbor = state.doc.child(neighborIndex);

	const from = direction < 0 ? block.start - neighbor.nodeSize : block.start;
	const to = direction < 0 ? block.end : block.end + neighbor.nodeSize;
	const ordered = direction < 0 ? [block.node, neighbor] : [neighbor, block.node];
	const tr = state.tr.replaceWith(from, to, Fragment.fromArray(ordered));
	const movedStart = direction < 0 ? from : from + neighbor.nodeSize;
	tr.setSelection(selectionInside(tr.doc, movedStart)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const block = topLevelBlockAt(state.doc, pos);
	if (!block) return false;
	const tr = state.tr.insert(block.end, block.node.copy(block.node.content));
	tr.setSelection(selectionInside(tr.doc, block.end)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const block = topLevelBlockAt(state.doc, pos);
	if (!block) return false;
	const tr = state.tr.delete(block.start, block.end);
	if (tr.doc.childCount > 0) tr.setSelection(selectionInside(tr.doc, Math.min(block.start, tr.doc.content.size - 1)));
	editor.view.dispatch(tr);
	return true;
}

/** 마우스 없이 블록을 조작하는 단축키(§4.2 "마우스 없이도 실행"). */
export const CmsBlockKeymap = Extension.create({
	name: "cmsBlockKeymap",
	addKeyboardShortcuts() {
		const at = () => this.editor.state.selection.from;
		return {
			"Alt-ArrowUp": () => moveBlock(this.editor, at(), -1),
			"Alt-ArrowDown": () => moveBlock(this.editor, at(), 1),
			"Mod-Shift-d": () => duplicateBlock(this.editor, at()),
			"Mod-Shift-Backspace": () => deleteBlock(this.editor, at()),
		};
	},
});

export const BLOCK_SHORTCUTS = [
	{ keys: "Alt+↑ / Alt+↓", label: "블록 위·아래 이동" },
	{ keys: "Mod+Shift+D", label: "블록 복제" },
	{ keys: "Mod+Shift+Backspace", label: "블록 삭제" },
] as const;
