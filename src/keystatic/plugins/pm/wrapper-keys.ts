import { joinTextblockBackward } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import { Fragment, NodeRange, type NodeType, type Schema, Slice } from "prosemirror-model";
import {
	type EditorState,
	Plugin,
	PluginKey,
	Selection,
	TextSelection,
	type Transaction,
} from "prosemirror-state";
import { ReplaceAroundStep, canJoin, liftTarget } from "prosemirror-transform";
import { isInCodeblock } from "./codeblock-keys";

const LIST_NODE_NAMES = new Set(["ordered_list", "unordered_list", "list_item"]);

type ActiveWrapperInfo = {
	depth: number;
	pos: number;
	type: NodeType;
};

const wrapperSelectionPluginKey = new PluginKey<{ pos: number } | null>("wrapper-selection");

function findWrapperInfosAtPos($pos: EditorState["selection"]["$from"]) {
	const infos: ActiveWrapperInfo[] = [];

	for (let d = $pos.depth; d > 0; d -= 1) {
		const type = $pos.node(d).type;
		const groupStr = type.spec.group ?? "";
		const isKeystaticComponent = groupStr.split(/\s+/).some((g) => g.startsWith("component"));
		const isWrapperLike = type.spec.content === "block+";

		if (!isKeystaticComponent || !isWrapperLike) continue;

		infos.push({
			depth: d,
			pos: $pos.before(d),
			type,
		});
	}

	return infos;
}

function findActiveWrapperInfoAtPos($pos: EditorState["selection"]["$from"]): ActiveWrapperInfo | null {
	return findWrapperInfosAtPos($pos)[0] ?? null;
}

function getWrapperSelectionRange($pos: EditorState["selection"]["$from"], depth: number) {
	const start = $pos.start(depth);
	const end = $pos.end(depth);

	return {
		from: Math.min(start + 1, end),
		to: Math.max(end - 1, Math.min(start + 1, end)),
	};
}

function getWrapperContentRange($pos: EditorState["selection"]["$from"], depth: number) {
	return {
		from: $pos.start(depth),
		to: $pos.end(depth),
	};
}

function resolveWrapperInfoInState(state: EditorState, pos: number) {
	const resolvedPos = state.doc.resolve(Math.min(pos + 1, state.doc.content.size));
	const wrapper = findWrapperInfosAtPos(resolvedPos).find((candidate) => candidate.pos === pos);
	if (!wrapper) return null;
	return { $pos: resolvedPos, wrapper };
}

function getSelectableWrapperRangeFromInfo(state: EditorState, wrapper: ActiveWrapperInfo) {
	const resolved = resolveWrapperInfoInState(state, wrapper.pos);
	if (!resolved) return null;

	const contentRange = getWrapperContentRange(resolved.$pos, resolved.wrapper.depth);
	const startSelection = Selection.findFrom(state.doc.resolve(contentRange.from), 1);
	const endSelection = Selection.findFrom(state.doc.resolve(contentRange.to), -1);
	if (!startSelection || !endSelection) return null;

	return {
		from: startSelection.from,
		to: endSelection.to,
	};
}

function findStoredWholeWrapperInfo(state: EditorState) {
	const storedWrapper = wrapperSelectionPluginKey.getState(state);
	if (!storedWrapper) return null;
	return resolveWrapperInfoInState(state, storedWrapper.pos)?.wrapper ?? null;
}

export function findActiveWrapperDepth(state: EditorState) {
	return findActiveWrapperInfoAtPos(state.selection.$from)?.depth ?? null;
}

export function isInAnyWrapper(state: EditorState) {
	return findActiveWrapperDepth(state) != null;
}

export function isInList(state: EditorState) {
	const { $from } = state.selection;

	for (let d = $from.depth; d > 0; d--) {
		if (LIST_NODE_NAMES.has($from.node(d).type.name)) return true;
	}

	return false;
}

function isAtTextblockStart(state: EditorState) {
	const { $cursor } = state.selection as TextSelection;
	if (!$cursor) return false;
	return $cursor.parent.isTextblock && $cursor.parentOffset === 0;
}

function liftToOuterList(
	state: EditorState,
	dispatch: (tr: Transaction) => void,
	itemType: NodeType,
	range: NodeRange,
) {
	let tr = state.tr;
	let end = range.end;
	const endOfList = range.$to.end(range.depth);

	if (end < endOfList) {
		tr.step(
			new ReplaceAroundStep(
				end - 1,
				endOfList,
				end,
				endOfList,
				new Slice(Fragment.from(itemType.create(null, range.parent.copy())), 1, 0),
				1,
				true,
			),
		);
		range = new NodeRange(tr.doc.resolve(range.$from.pos), tr.doc.resolve(endOfList), range.depth);
	}

	const target = liftTarget(range);
	if (target == null) return false;

	tr.lift(range, target);
	const after = tr.mapping.map(end, -1) - 1;
	if (canJoin(tr.doc, after)) tr.join(after);
	dispatch(tr.scrollIntoView());
	return true;
}

function liftOutOfList(state: EditorState, dispatch: (tr: Transaction) => void, range: NodeRange) {
	let tr = state.tr;
	const list = range.parent;

	for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i -= 1) {
		pos -= list.child(i).nodeSize;
		tr.delete(pos - 1, pos + 1);
	}

	const $start = tr.doc.resolve(range.start);
	const item = $start.nodeAfter;
	if (!item) return false;
	if (tr.mapping.map(range.end) !== range.start + item.nodeSize) return false;

	const atStart = range.startIndex === 0;
	const atEnd = range.endIndex === list.childCount;
	const parent = $start.node(-1);
	const indexBefore = $start.index(-1);

	if (
		!parent.canReplace(
			indexBefore + (atStart ? 0 : 1),
			indexBefore + 1,
			item.content.append(atEnd ? Fragment.empty : Fragment.from(list)),
		)
	) {
		return false;
	}

	const start = $start.pos;
	const end = start + item.nodeSize;
	tr.step(
		new ReplaceAroundStep(
			start - (atStart ? 1 : 0),
			end + (atEnd ? 1 : 0),
			start + 1,
			end - 1,
			new Slice(
				(atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))).append(
					atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)),
				),
				atStart ? 0 : 1,
				atEnd ? 0 : 1,
			),
			atStart ? 0 : 1,
		),
	);
	dispatch(tr.scrollIntoView());
	return true;
}

function liftListItemBackward(state: EditorState, dispatch: (tr: Transaction) => void) {
	const itemType = state.schema.nodes.list_item;
	if (!itemType) return false;
	if (!state.selection.empty || !isAtTextblockStart(state)) return false;

	const { $from, $to } = state.selection;
	const range = $from.blockRange($to, (node) => node.childCount > 0 && node.firstChild?.type === itemType);
	if (!range) return false;

	if ($from.node(range.depth - 1).type === itemType) {
		return liftToOuterList(state, dispatch, itemType, range);
	}

	return liftOutOfList(state, dispatch, range);
}

export function getActiveWrapperSelectionRange(state: EditorState) {
	const depth = findActiveWrapperDepth(state);
	if (depth == null) return null;

	const { $from } = state.selection;
	return getWrapperSelectionRange($from, depth);
}

export function hasPreviousSiblingWithinWrapper(state: EditorState) {
	const depth = findActiveWrapperDepth(state);
	if (depth == null) return false;

	const { $from } = state.selection;
	for (let currentDepth = $from.depth; currentDepth > depth; currentDepth -= 1) {
		if ($from.index(currentDepth - 1) > 0) return true;
	}

	return false;
}

export function isWholeWrapperContentSelected(state: EditorState) {
	return getSelectedWholeWrapperRange(state) != null;
}

export function getSelectedWholeWrapperRange(state: EditorState) {
	if (state.selection.empty) return null;

	const storedInfo = findStoredWholeWrapperInfo(state);
	if (storedInfo) {
		const resolved = resolveWrapperInfoInState(state, storedInfo.pos);
		if (resolved) {
			return getWrapperSelectionRange(resolved.$pos, resolved.wrapper.depth);
		}
	}

	const { from, to, $from, $to } = state.selection;
	const toWrappers = new Set(findWrapperInfosAtPos($to).map((wrapper) => wrapper.pos));

	for (const wrapper of findWrapperInfosAtPos($from)) {
		if (!toWrappers.has(wrapper.pos)) continue;

		const range = getWrapperSelectionRange($from, wrapper.depth);
		if (from > range.from || to < range.to) continue;

		return range;
	}

	return null;
}

function findSelectedWholeWrapperInfo(state: EditorState) {
	if (state.selection.empty) return null;

	const storedInfo = findStoredWholeWrapperInfo(state);
	if (storedInfo) {
		return storedInfo;
	}

	const { from, to, $from, $to } = state.selection;
	const toWrappers = new Set(findWrapperInfosAtPos($to).map((wrapper) => wrapper.pos));

	for (const wrapper of findWrapperInfosAtPos($from)) {
		if (!toWrappers.has(wrapper.pos)) continue;

		const range = getSelectableWrapperRangeFromInfo(state, wrapper);
		if (!range) continue;
		if (from > range.from || to < range.to) continue;

		return wrapper;
	}

	return null;
}

function isSelectionWithinSingleWrapper(state: EditorState) {
	const fromWrapper = findActiveWrapperInfoAtPos(state.selection.$from);
	const toWrapper = findActiveWrapperInfoAtPos(state.selection.$to);
	if (!fromWrapper || !toWrapper) return null;
	if (fromWrapper.pos !== toWrapper.pos) return null;
	return fromWrapper;
}

function replaceWrapperContentsWithParagraph(
	state: EditorState,
	dispatch: (tr: Transaction) => void,
	wrapper: ActiveWrapperInfo,
) {
	const paragraphType = state.schema.nodes.paragraph;
	const paragraph = paragraphType?.createAndFill();
	if (!paragraph) return false;

	const resolved = resolveWrapperInfoInState(state, wrapper.pos);
	if (!resolved) return false;

	const contentRange = getWrapperContentRange(resolved.$pos, resolved.wrapper.depth);
	let tr = state.tr.replaceWith(contentRange.from, contentRange.to, paragraph);
	const cursorPos = Math.min(contentRange.from + 1, tr.doc.content.size);
	tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), 1));
	dispatch(tr.scrollIntoView());
	return true;
}

function deleteSelectionWithinWrapper(state: EditorState, dispatch: (tr: Transaction) => void) {
	if (state.selection.empty) return false;

	const wholeWrapper = findSelectedWholeWrapperInfo(state);
	if (wholeWrapper) {
		return replaceWrapperContentsWithParagraph(state, dispatch, wholeWrapper);
	}

	const wrapper = isSelectionWithinSingleWrapper(state);
	if (!wrapper) return false;

	const simulated = state.tr.deleteSelection();
	const mappedWrapperPos = simulated.mapping.map(wrapper.pos, -1);
	const mappedWrapperNode = simulated.doc.nodeAt(mappedWrapperPos);

	if (mappedWrapperNode?.type === wrapper.type && mappedWrapperNode.childCount > 0) {
		dispatch(simulated.scrollIntoView());
		return true;
	}

	return replaceWrapperContentsWithParagraph(state, dispatch, wrapper);
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

	// 3) wrapper 내부에 앞선 형제가 있으면, 기본 keymap이 리스트/문단 병합을 처리하게 둔다.
	if (hasPreviousSiblingWithinWrapper(state)) {
		return joinTextblockBackward(state, dispatch);
	}

	// 4) wrapper의 진짜 첫 지점만 막아 wrapper 자체 삭제를 방지한다.
	return true;
}

const selectAllWithinWrapper = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
	if (isInCodeblock(state) || !isInAnyWrapper(state)) return false;

	const wrapper = findActiveWrapperInfoAtPos(state.selection.$from);
	if (!wrapper) return false;

	const range = getSelectableWrapperRangeFromInfo(state, wrapper);
	if (!range) return false;
	if (!dispatch) return true;

	dispatch(
		state.tr
			.setSelection(TextSelection.create(state.doc, range.from, range.to))
			.setMeta(wrapperSelectionPluginKey, { pos: wrapper.pos })
			.scrollIntoView(),
	);
	return true;
};

export function wrapperKeysPlugin(schema: Schema): Plugin {
	return new Plugin({
		key: wrapperSelectionPluginKey,
		state: {
			init: () => null,
			apply: (tr, value) => {
				const meta = tr.getMeta(wrapperSelectionPluginKey);
				if (meta !== undefined) return meta;
				if (tr.selectionSet) return null;
				return value;
			},
		},
		props: {
			handleKeyDown: keydownHandler({
				Backspace: (state, dispatch) => {
					if (!isInAnyWrapper(state)) return false;
					if (!dispatch) return false;
					if (deleteSelectionWithinWrapper(state, dispatch)) return true;
					if (isInList(state)) {
						if (liftListItemBackward(state, dispatch)) return true;
						return false;
					}
					return deleteCharOrHardBreakBackward(state, dispatch, schema);
				},
				Delete: (state, dispatch) => {
					if (!isInAnyWrapper(state)) return false;
					if (!dispatch) return false;
					return deleteSelectionWithinWrapper(state, dispatch);
				},
				"Mod-a": selectAllWithinWrapper,
			}),
		},
	});
}
