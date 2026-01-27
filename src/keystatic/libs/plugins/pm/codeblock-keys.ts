import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { type EditorState, type Plugin, TextSelection } from "prosemirror-state";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";

export function isInCodeblock(state: EditorState) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type?.name === EDITOR_CODE_BLOCK_NAME) return true;
	}
	return false;
}

function findCodeBlockDepth(state: EditorState): number | null {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type?.name === EDITOR_CODE_BLOCK_NAME) return d;
	}
	return null;
}

export function codeBlockKeysPlugin(schema: Schema, indent = "\t"): Plugin {
	return keymap({
		"Mod-a": (state, dispatch) => {
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
		},
		Tab: (state, dispatch) => {
			if (!isInCodeblock(state)) return false;
			if (!dispatch) return true;
			dispatch(state.tr.insertText(indent));
			return true;
		},
		Enter: (state, dispatch) => {
			if (!isInCodeblock(state)) return false;
			const br = schema.nodes?.hard_break;
			if (!br) return false;

			if (!dispatch) return true;
			dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
			return true;
		},
	});
}
