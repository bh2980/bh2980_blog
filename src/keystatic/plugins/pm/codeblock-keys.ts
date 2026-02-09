import { splitBlock } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { type EditorState, type Plugin, Selection, TextSelection, type Transaction } from "prosemirror-state";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";
import { EDITOR_MERMAID_NAME } from "@/keystatic/fields/mdx/components/mermaid";

const CODE_BLOCK_USE_BLOCK = [EDITOR_CODE_BLOCK_NAME, EDITOR_MERMAID_NAME];

export const isCodeBlockType = (nodeName: string) => CODE_BLOCK_USE_BLOCK.some((name) => nodeName === name);

export function isInCodeblock(state: EditorState) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		if (isCodeBlockType($from.node(d).type.name)) return true;
	}
	return false;
}

function findCodeBlockDepth(state: EditorState): number | null {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		if (isCodeBlockType($from.node(d).type.name)) return d;
	}
	return null;
}

const exitWrapper = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
	const depth = findCodeBlockDepth(state);
	if (depth == null) return false;

	const { $from } = state.selection;
	const posAfter = $from.after(depth); // wrapper 바깥 위치 (depth 기준)  [oai_citation:2‡app.unpkg.com](https://app.unpkg.com/prosemirror-model%401.19.3/files/src/resolvedpos.ts?utm_source=chatgpt.com)

	if (!dispatch) return true;

	let tr = state.tr;

	// 1) 일단 바깥으로 selection 이동 시도
	const sel = Selection.near(tr.doc.resolve(posAfter), 1);

	// sel이 여전히 코드블록 내부/커서 불가 위치면 paragraph 삽입
	const stillInCodeblock = (() => {
		const $p = sel.$from;
		for (let d = $p.depth; d > 0; d--) {
			if (isCodeBlockType($p.node(d).type.name)) return true;
		}
		return false;
	})();

	const isTextCursorPlace = sel instanceof TextSelection && sel.$from.parent.isTextblock;

	if (!isTextCursorPlace || stillInCodeblock) {
		const paragraphType = state.schema.nodes.paragraph;
		const paragraph = paragraphType?.createAndFill();
		if (paragraph) {
			const $pos = tr.doc.resolve(posAfter);
			const index = $pos.index();

			// 해당 부모가 paragraph를 허용하면 삽입
			if ($pos.parent.canReplaceWith(index, index, paragraphType)) {
				tr = tr.insert(posAfter, paragraph);

				// paragraph 내부로 커서 이동 (posAfter + 1이 보통 텍스트 커서 자리)
				tr = tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
				dispatch(tr.scrollIntoView());
				return true;
			}
		}
	}

	// paragraph 삽입이 불가하면 가능한 곳으로만 이동
	dispatch(tr.setSelection(sel).scrollIntoView());
	return true;
};

const selectAllOnlyCodeBlock = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
	const depth = findCodeBlockDepth(state);
	if (depth == null) return false;

	const { $from } = state.selection;
	// wrapper content 경계
	const start = $from.start(depth);
	const end = $from.end(depth);

	// 전체 선택 시 블록 자체를 지워버리는 거 방지
	const from = Math.min(start + 1, end);
	const to = Math.max(end - 1, from);

	if (!dispatch) return true;

	// wrapper 내부만 전체 선택
	dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView());
	return true;
};

const insertIndentWhenTab = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
	if (!isInCodeblock(state)) return false;
	if (!dispatch) return true;
	dispatch(state.tr.insertText("\t"));
	return true;
};

const insertHardBreakWhenEnter = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
	if (!isInCodeblock(state)) return false;
	const br = state.schema.nodes?.hard_break;
	if (!br) return false;

	if (!dispatch) return true;
	dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
	return true;
};

export function codeBlockKeysPlugin(schema: Schema): Plugin {
	return keymap({
		"Mod-Enter": exitWrapper,
		"Ctrl-Enter": exitWrapper,
		"Mod-a": selectAllOnlyCodeBlock,
		"Shift-Enter": splitBlock,
		Tab: insertIndentWhenTab,
		Enter: insertHardBreakWhenEnter,
	});
}
