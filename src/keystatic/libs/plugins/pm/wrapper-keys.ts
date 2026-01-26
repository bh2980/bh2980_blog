import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import type { EditorState, Plugin, Transaction } from "prosemirror-state";
import { canJoin } from "prosemirror-transform";

export function isInAnyWrapper(state: EditorState) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		const type = $from.node(d).type;

		// Keystatic content component는 보통 spec.group에 "componentN" 형태가 들어감
		const groupStr = type.spec.group ?? "";
		const isKeystaticComponent = groupStr.split(/\s+/).some((g) => g.startsWith("component"));

		// wrapper류는 content가 block+ 인 케이스가 많음
		const isWrapperLike = type.spec.content === "block+";

		if (isKeystaticComponent && isWrapperLike) return true;
	}

	return false;
}

function deleteCharOrHardBreakBackward(state: EditorState, dispatch: (tr: Transaction) => void, schema: Schema) {
	const { from, empty } = state.selection;
	if (!empty) return false;
	if (from <= 0) return true; // 문서 시작: 아무 것도 안 하고 막기

	const $from = state.doc.resolve(from);
	const nodeBefore = $from.nodeBefore;

	// 1) 바로 앞이 hard_break면 그걸 삭제(줄 합치기)
	if (nodeBefore && nodeBefore.type === schema.nodes?.hard_break) {
		if (!dispatch) return true;
		dispatch(state.tr.delete(from - 1, from).scrollIntoView());
		return true;
	}

	// 2) 바로 앞이 텍스트(또는 inline)면 한 글자 삭제
	//    (text node일 때는 from-1..from 삭제가 안전)
	if ($from.parentOffset > 0) {
		if (!dispatch) return true;
		dispatch(state.tr.delete(from - 1, from).scrollIntoView());
		return true;
	}

	// 3) 문단 맨 앞: 같은 wrapper 내부에서만 "joinBackward" 허용
	//    (이전 형제가 있을 때만 join; 없으면 wrapper 밖으로 join될 수 있으니 막음)
	const depth = $from.depth;
	if (depth >= 1) {
		const parentDepth = depth - 1;
		const indexInParent = $from.index(parentDepth); // 현재 블록(문단)의 부모에서의 인덱스
		if (indexInParent > 0) {
			const joinPos = $from.before(depth); // 이전 블록과 현재 블록 사이의 위치
			if (canJoin(state.doc, joinPos)) {
				if (!dispatch) return true;
				dispatch(state.tr.join(joinPos).scrollIntoView());
				return true;
			}
		}
	}

	// 4) 그 외(첫 문단 시작 등): wrapper 삭제로 튈 수 있으니 막기
	return true;
}

export function wrapperKeysPlugin(schema: Schema): Plugin {
	return keymap({
		Backspace: (state, dispatch) => {
			if (!isInAnyWrapper(state)) return false;
			if (!dispatch) return false;
			return deleteCharOrHardBreakBackward(state, dispatch, schema);
		},
	});
}
