import { keymap } from "prosemirror-keymap";
import { type Plugin, TextSelection } from "prosemirror-state";

export function isInCodeBlock(state: any) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		const node = $from.node(d);
		const name = node.type?.name;
		const attrs = node.attrs ?? {};

		// TODO: 실제 형태에 맞춰 조정
		if (name === "CodeBlock") return true;
		if (name === "component" || name === "wrapper" || name === "contentComponent") {
			if (attrs.component === "CodeBlock" || attrs.name === "CodeBlock") return true;
		}
	}
	return false;
}

function deleteCharOrHardBreakBackward(state: any, dispatch: any, schema: any) {
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

	// 3) 여기까지 오면 보통 블록 경계(joinBackward) 케이스.
	//    wrapper 삭제로 이어질 수 있으니 막음.
	return true;
}

function findCodeBlockDepth(state: any) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		const node = $from.node(d);
		const name = node.type?.name;
		const attrs = node.attrs ?? {};

		if (name === "CodeBlock") return d;

		if (name === "component" || name === "wrapper" || name === "contentComponent") {
			if (attrs.component === "CodeBlock" || attrs.name === "CodeBlock") return d;
		}
	}
	return null;
}

export function codeBlockKeysPlugin(schema: any, indent = "\t"): Plugin {
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
			if (!isInCodeBlock(state)) return false;
			if (!dispatch) return true;
			dispatch(state.tr.insertText(indent));
			return true;
		},
		Enter: (state, dispatch) => {
			if (!isInCodeBlock(state)) return false;
			const br = schema.nodes?.hard_break;
			if (!br) return false;

			if (!dispatch) return true;
			dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
			return true;
		},
		Backspace: (state, dispatch) => {
			return deleteCharOrHardBreakBackward(state, dispatch, schema);
		},
	});
}
