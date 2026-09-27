import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 블록 요소 해석 규약 및 DOM 탐색(v2 C1).
 * 최상위 블록, 중첩 블록(목록 항목, 인용구 내부), NodeView 컨테이너(content hole)를 공통 규약으로 다룬다.
 */

/**
 * 자식 블록을 하나씩 옮길 수 있는 컨테이너 노드 이름. C3의 컨테이너 NodeView(콜아웃·접기·탭·단 등)는 여기에 이름을 더한다.
 * 이 목록에 없는 부모(표 셀 등)의 자식은 따로 옮기지 않고 부모 블록 단위로 옮긴다.
 */
export const DRAG_CONTAINER_NODES = new Set<string>(["blockquote"]);

export interface TargetBlock {
	node: PmNode;
	start: number;
	end: number;
	depth: number;
	index: number;
	parent: PmNode;
}

/**
 * 주어진 DOM 엘리먼트로부터 핸들이 부착될 블록 수준 DOM 엘리먼트를 찾는다.
 * - 최상위 블록: 에디터 root의 직계 자식
 * - 목록 항목: <li> 및 [data-type="taskItem"]
 * - 인용문 내부: <blockquote>의 직계 자식 블록
 * - 컨테이너 NodeView 내부: [data-node-view-content] (content hole)의 직계 자식 블록
 * - 컨테이너 NodeView 자체: contentDOM 외부의 헤더/패딩 등에 호버할 때
 */
export function findBlockDOM(root: HTMLElement, target: HTMLElement | null): HTMLElement | null {
	if (!target || !root.contains(target) || target === root) return null;

	let current: HTMLElement | null = target;

	while (current && current !== root) {
		const parent: HTMLElement | null = current.parentElement;
		if (!parent) break;

		// 1. 에디터 root의 직계 자식이면 최상위 블록
		if (parent === root) {
			return current;
		}

		// 2. 목록 항목 (ul/ol 아래의 li)
		if (current.tagName === "LI" || current.getAttribute("data-type") === "taskItem") {
			return current;
		}

		// 3. 인용구 직계 자식 블록
		if (parent.tagName === "BLOCKQUOTE") {
			return current;
		}

		// 4. 컨테이너 NodeView의 content hole(data-node-view-content) 직계 자식 블록
		if (parent.hasAttribute("data-node-view-content") || parent.classList.contains("ProseMirror-content")) {
			return current;
		}

		// 5. 컨테이너 NodeView의 래퍼(data-node-view-wrapper) 직계 영역 (헤더/배경 등)
		if (parent.hasAttribute("data-node-view-wrapper")) {
			if (!current.hasAttribute("data-node-view-content")) {
				let wrapper: HTMLElement | null = parent;
				while (
					wrapper &&
					wrapper.parentElement !== root &&
					!wrapper.parentElement?.hasAttribute("data-node-view-content")
				) {
					wrapper = wrapper.parentElement;
				}
				if (wrapper) return wrapper;
			}
		}

		current = parent;
	}

	return current !== root ? current : null;
}

/**
 * 문서 위치가 가리키는 이동 대상 블록을 찾는다.
 * - 목록 항목(listItem / taskItem): depth를 listItem 레벨로 맞춰 항목 전체를 이동 단위로 삼는다.
 * - 인용구 / 컨테이너 내부 블록: 자식 블록 단위로 이동한다.
 * - 최상위 블록: depth 1 블록 단위로 이동한다.
 */
export function targetBlockAt(doc: PmNode, pos: number): TargetBlock | null {
	if (doc.childCount === 0) return null;
	const safePos = Math.max(0, Math.min(pos, doc.content.size));
	const $pos = doc.resolve(safePos);

	// 블록 바로 앞 위치(원자 블록의 posAtDOM, 블록 전체 선택, 핸들 메뉴가 넘기는 블록 시작)면 그 블록이 대상이다.
	// 목록 항목 안의 블록은 항목이 이동 단위다(아래 1번).
	const after = $pos.nodeAfter;
	const inListItem = $pos.parent.type.name === "listItem" || $pos.parent.type.name === "taskItem";
	if (after?.isBlock && !inListItem) {
		return {
			node: after,
			start: safePos,
			end: safePos + after.nodeSize,
			depth: $pos.depth + 1,
			index: $pos.index(),
			parent: $pos.parent,
		};
	}

	if ($pos.depth === 0) {
		// 문서 끝 등 블록 사이: 가장 가까운 최상위 블록.
		const index = Math.min($pos.index(0), doc.childCount - 1);
		let start = 0;
		for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
		const node = doc.child(index);
		return { node, start, end: start + node.nodeSize, depth: 1, index, parent: doc };
	}

	// 1. 목록 항목 확인 (listItem, taskItem)
	for (let d = $pos.depth; d >= 1; d--) {
		const n = $pos.node(d);
		if (n.type.name === "listItem" || n.type.name === "taskItem") {
			const start = $pos.before(d);
			return {
				node: n,
				start,
				end: $pos.after(d),
				depth: d,
				index: $pos.index(d - 1),
				parent: $pos.node(d - 1),
			};
		}
	}

	// 2. 인용문 또는 컨테이너 내부 블록 확인
	for (let d = $pos.depth; d >= 1; d--) {
		const n = $pos.node(d);
		const parent = $pos.node(d - 1);
		if (n.isBlock && parent && DRAG_CONTAINER_NODES.has(parent.type.name)) {
			const start = $pos.before(d);
			return {
				node: n,
				start,
				end: $pos.after(d),
				depth: d,
				index: $pos.index(d - 1),
				parent,
			};
		}
	}

	// 3. 최상위 블록 (depth 1)
	const d = 1;
	const node = $pos.node(d);
	if (node) {
		const start = $pos.before(d);
		return {
			node,
			start,
			end: $pos.after(d),
			depth: d,
			index: $pos.index(0),
			parent: doc,
		};
	}

	return null;
}

/**
 * 찾은 블록 DOM 엘리먼트로부터 ProseMirror 위치 및 블록 정보를 계산한다.
 */
export function resolveTargetBlock(
	view: EditorView,
	blockEl: HTMLElement,
): { pos: number; node: PmNode; rect: DOMRect } | null {
	try {
		const pos = view.posAtDOM(blockEl, 0);
		const rect = blockEl.getBoundingClientRect();

		const target = targetBlockAt(view.state.doc, pos);
		if (target) {
			return { pos: target.start, node: target.node, rect };
		}

		return null;
	} catch {
		return null;
	}
}
