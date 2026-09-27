import { Fragment, type Node as PmNode, Slice } from "@tiptap/pm/model";
import { type EditorState, NodeSelection, Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";

/**
 * 블록 드래그 앤 드롭 순수 명령 함수들(v2 C1).
 * DOM 의존 없이 ProseMirror 트랜잭션 및 스키마 검증을 jsdom/단위 테스트에서 수행할 수 있다.
 */

/**
 * 대상 위치(targetPos)가 스키마상 해당 블록(fromPos)을 허용하는지 검증한다.
 * - 자기 자신 내부나 경계(no-op)로의 드롭은 거부한다.
 * - canReplaceWith / contentMatch 검사를 통해 스키마가 허용하지 않는 위치는 거부한다.
 */
export function canDropBlockNode(doc: PmNode, fromPos: number, targetPos: number): boolean {
	if (fromPos < 0 || fromPos >= doc.content.size) return false;
	const node = doc.nodeAt(fromPos);
	if (!node) return false;

	const nodeEnd = fromPos + node.nodeSize;
	// 자기 자신 내부 또는 바로 인접한 no-op 위치로의 드롭은 거부한다.
	if (targetPos >= fromPos && targetPos <= nodeEnd) return false;
	if (targetPos < 0 || targetPos > doc.content.size) return false;

	// 꺼낸 자리의 부모가 규칙을 잃으면(예: 목록 항목의 하나뿐인 문단) 옮기지 않는다. 빈 블록이 자동으로 채워지는 것을 막는다.
	const $from = doc.resolve(fromPos);
	if (!$from.parent.canReplace($from.index(), $from.index() + 1)) return false;

	const $target = doc.resolve(targetPos);
	const parent = $target.parent;
	if (!parent) return false;

	const index = $target.index();
	return parent.canReplaceWith(index, index, node.type);
}

/**
 * 마우스 좌표/위치로부터 유효한 스키마 드롭 위치를 계산한다.
 * - 텍스트 블록 안으로 떨어진 경우 dropPoint를 통해 앞/뒤 부모 경계의 유효 위치를 탐색한다.
 * - 스키마가 허용하지 않는 경우 null을 반환하여 드롭을 무시한다.
 */
export function calculateDropPosition(
	doc: PmNode,
	fromPos: number,
	rawTargetPos: number,
	slice?: Slice,
): number | null {
	const node = doc.nodeAt(fromPos);
	if (!node) return null;

	const contentSlice = slice ?? new Slice(Fragment.from(node), 0, 0);

	// ProseMirror의 dropPoint를 통해 스키마에 맞는 유효 삽입 지점 계산 시도
	let point = dropPoint(doc, rawTargetPos, contentSlice);

	if (point === null) {
		// 블록 사이 정확한 위치로 떨어진 경우 직접 canDropBlockNode 확인
		if (canDropBlockNode(doc, fromPos, rawTargetPos)) {
			point = rawTargetPos;
		} else {
			return null;
		}
	}

	// 최종 계산된 위치가 canDropBlockNode 조건을 만족하는지 재검증
	if (!canDropBlockNode(doc, fromPos, point)) {
		return null;
	}

	return point;
}

/** 이동된 노드에 적합한 선택 영역을 반환한다 (원자 노드는 NodeSelection, 일반 블록은 TextSelection/Selection). */
export function selectionForMovedNode(doc: PmNode, pos: number, node: PmNode): Selection | null {
	try {
		if (NodeSelection.isSelectable(node)) {
			return NodeSelection.create(doc, pos);
		}
	} catch {
		// 노드 선택이 불가능하면 텍스트 커서 선택으로 이동
	}
	try {
		return TextSelection.near(doc.resolve(Math.min(pos + 1, doc.content.size)));
	} catch {
		return Selection.near(doc.resolve(pos));
	}
}

/**
 * 단일 트랜잭션으로 블록을 fromPos에서 targetPos로 이동한다 ("한 드래그 = 한 undo").
 * 스키마가 허용하지 않으면 null을 반환하고 아무 작업도 하지 않는다.
 */
export function moveBlockNode(state: EditorState, fromPos: number, targetPos: number): Transaction | null {
	const { doc } = state;
	const node = doc.nodeAt(fromPos);
	if (!node) return null;

	if (!canDropBlockNode(doc, fromPos, targetPos)) {
		return null;
	}

	const nodeEnd = fromPos + node.nodeSize;
	const tr = state.tr;

	// 단일 트랜잭션 내에서 삭제 및 삽입을 함께 처리해 단 1회의 Undo 단계를 보장한다
	tr.delete(fromPos, nodeEnd);
	const mappedTarget = tr.mapping.map(targetPos);
	tr.insert(mappedTarget, node);

	const selection = selectionForMovedNode(tr.doc, mappedTarget, node);
	if (selection) {
		tr.setSelection(selection);
	}
	tr.scrollIntoView();

	return tr;
}
