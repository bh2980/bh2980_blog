import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { calculateDropPosition, moveBlockNode, selectedBlockRange } from "./drag-commands";

export const BLOCK_DRAG_MIME_TYPE = "application/x-cms-block-drag";

/** 여러 블록 선택 중인 편집기와 선택된 블록에 붙는 클래스(스타일은 편집기 클래스에 둔다). */
export const BLOCK_RANGE_CLASS = "cms-block-range";
export const BLOCK_SELECTED_CLASS = "cms-block-selected";

export const cmsBlockDragPluginKey = new PluginKey<{ dropPos: number | null }>("cmsBlockDrag");

/** 블록 드래그 중 실제로 놓일 위치만 표시한다. 놓을 수 없는 곳이면 표시를 지운다. */
function setDropIndicator(view: EditorView, dropPos: number | null) {
	if (cmsBlockDragPluginKey.getState(view.state)?.dropPos === dropPos) return;
	view.dispatch(view.state.tr.setMeta(cmsBlockDragPluginKey, { dropPos }).setMeta("addToHistory", false));
}

/**
 * 놓일 위치에 가로선을 그린다. 문서 흐름 밖(offsetParent 기준 absolute)에 두어
 * 블록 사이 여백·첫 블록 규칙을 바꾸지 않는다(드래그 중 레이아웃 이동 없음).
 */
function createDropIndicatorView(editorView: EditorView) {
	let element: HTMLElement | null = null;

	const remove = () => {
		element?.remove();
		element = null;
	};

	const update = (view: EditorView) => {
		const dropPos = cmsBlockDragPluginKey.getState(view.state)?.dropPos;
		if (dropPos === null || dropPos === undefined) return remove();
		const $pos = view.state.doc.resolve(dropPos);
		const beforeDom = $pos.nodeBefore ? view.nodeDOM(dropPos - $pos.nodeBefore.nodeSize) : null;
		const afterDom = $pos.nodeAfter ? view.nodeDOM(dropPos) : null;
		const before = beforeDom instanceof HTMLElement ? beforeDom.getBoundingClientRect() : null;
		const after = afterDom instanceof HTMLElement ? afterDom.getBoundingClientRect() : null;
		const box = after ?? before;
		if (!box) return remove();
		const y = before && after ? (before.bottom + after.top) / 2 : after ? after.top : box.bottom;

		const parent = (view.dom.offsetParent as HTMLElement | null) ?? view.dom.parentElement;
		if (!parent) return remove();
		const parentRect = parent.getBoundingClientRect();
		if (!element) {
			element = document.createElement("div");
			element.setAttribute("aria-hidden", "true");
			element.dataset.cmsDropIndicator = "";
			element.className = "pointer-events-none absolute z-50 h-0.5 -translate-y-1/2 rounded-full bg-primary";
			parent.appendChild(element);
		}
		element.style.left = `${box.left - parentRect.left + parent.scrollLeft}px`;
		element.style.top = `${y - parentRect.top + parent.scrollTop}px`;
		element.style.width = `${box.width}px`;
	};

	update(editorView);
	return { update, destroy: remove };
}

/**
 * 블록 핸들 dragstart 시 호출되어 ProseMirror 드래그 상태와 dataTransfer를 초기화한다.
 * 잡은 블록이 여러 블록 선택(selectedBlockRange) 안에 있으면 선택된 블록 전체를 함께 끈다.
 */
export function startBlockDrag(
	view: EditorView,
	pos: number,
	event: React.DragEvent<HTMLElement> | DragEvent,
): boolean {
	const { state } = view;
	const node = state.doc.nodeAt(pos);
	if (!node) return false;

	const range = selectedBlockRange(state);
	const inRange = range && pos >= range.from && pos + node.nodeSize <= range.to ? range : null;

	let slice: Slice;
	let selection = state.selection;
	if (inRange) {
		// 여러 블록 선택은 그대로 두고(강조가 유지된다) 선택된 블록 전체를 옮길 내용으로 삼는다.
		slice = state.doc.slice(inRange.from, inRange.to);
	} else {
		// 노드 선택(NodeSelection)이 가능하면 선택 영역으로 지정한다
		if (NodeSelection.isSelectable(node)) {
			selection = NodeSelection.create(state.doc, pos);
			view.dispatch(state.tr.setSelection(selection));
		}
		slice = selection instanceof NodeSelection ? selection.content() : new Slice(Fragment.from(node), 0, 0);
	}
	const from = inRange ? inRange.from : pos;
	const to = inRange ? inRange.to : pos + node.nodeSize;

	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", state.doc.textBetween(from, to, "\n"));
		try {
			event.dataTransfer.setData(BLOCK_DRAG_MIME_TYPE, JSON.stringify({ pos: from, end: to, type: node.type.name }));
		} catch {
			// 일부 브라우저 제한 시 무시
		}
	}

	// ProseMirror 기본 드래그 객체(Dropcursor 및 drop 핸들러에서 참조) 설정
	(view as unknown as { dragging: unknown }).dragging = {
		slice,
		move: true,
		node: !inRange && selection instanceof NodeSelection ? selection : undefined,
		cmsBlockPos: from,
		cmsBlockEnd: to,
	};

	return true;
}

/**
 * 드래그 종료 시 상태를 정리한다.
 */
export function endBlockDrag(view: EditorView): void {
	const viewAny = view as unknown as { dragging: { cmsBlockPos?: number } | null };
	const dragging = viewAny.dragging;
	// 핸들 드래그만 정리한다(에디터 자체 드래그는 ProseMirror가 정리한다).
	// 일부 브라우저는 drop보다 dragend를 먼저 보내므로 ProseMirror처럼 잠시 기다렸다가 지운다.
	// 이동 트랜잭션 뒤 ProseMirror가 dragging을 새 객체로 바꿔 cmsBlockPos가 사라질 수 있으므로 표시는 먼저 지운다.
	if (!view.isDestroyed) setDropIndicator(view, null);
	if (!dragging || dragging.cmsBlockPos === undefined) return;
	setTimeout(() => {
		if (viewAny.dragging === dragging) viewAny.dragging = null;
	}, 50);
}

/**
 * Tiptap 블록 드래그 앤 드롭 확장(v2 C1).
 * 스키마 검증, 단일 undo 트랜잭션, 허용되지 않는 위치 거부를 제공한다.
 */
export const CmsBlockDrag = Extension.create({
	name: "cmsBlockDrag",

	addProseMirrorPlugins() {
		return [
			// 선택이 여러 블록에 걸치면 걸친 블록을 통째로 칠한다(노션의 블록 선택). 그 블록 중 하나의 핸들을
			// 끌면 전부 함께 옮긴다(startBlockDrag). 글자 선택 표시는 그동안 숨긴다(편집기 클래스 참고).
			new Plugin({
				key: new PluginKey("cmsBlockRangeHighlight"),
				props: {
					attributes: (state): Record<string, string> =>
						selectedBlockRange(state) ? { class: BLOCK_RANGE_CLASS } : {},
					decorations(state) {
						const range = selectedBlockRange(state);
						if (!range) return null;
						const decorations: Decoration[] = [];
						let pos = range.from;
						while (pos < range.to) {
							const node = state.doc.nodeAt(pos);
							if (!node) break;
							decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: BLOCK_SELECTED_CLASS }));
							pos += node.nodeSize;
						}
						return DecorationSet.create(state.doc, decorations);
					},
				},
			}),
			new Plugin({
				key: cmsBlockDragPluginKey,
				state: {
					init: () => ({ dropPos: null as number | null }),
					apply(tr, value) {
						const meta = tr.getMeta(cmsBlockDragPluginKey) as { dropPos: number | null } | undefined;
						if (meta) return meta;
						if (value.dropPos === null || !tr.docChanged) return value;
						return { dropPos: tr.mapping.map(value.dropPos) };
					},
				},
				view: createDropIndicatorView,
				props: {
					handleDOMEvents: {
						dragover(view, event) {
							const viewAny = view as unknown as {
								dragging?: { cmsBlockPos?: number; cmsBlockEnd?: number; slice?: Slice };
							};
							const dragging = viewAny.dragging;
							if (dragging && dragging.cmsBlockPos !== undefined && event.dataTransfer) {
								// 기본 Dropcursor는 스키마 거부를 모르고 다른 위치를 가리킨다. 블록 드래그에서는 막고 직접 표시한다.
								event.stopImmediatePropagation();
								const coords = { left: event.clientX, top: event.clientY };
								const target = view.posAtCoords(coords);
								const validPos = target
									? calculateDropPosition(
											view.state.doc,
											dragging.cmsBlockPos,
											target.pos,
											dragging.slice,
											dragging.cmsBlockEnd,
										)
									: null;
								setDropIndicator(view, validPos);
								event.dataTransfer.dropEffect = validPos === null ? "none" : "move";
							}
							return false;
						},
						dragleave(view, event) {
							const related = event.relatedTarget;
							if (related instanceof Node) {
								if (!view.dom.contains(related)) setDropIndicator(view, null);
							} else {
								// Safari는 자식 경계에서도 relatedTarget=null을 줄 수 있다. 실제로 편집기 밖일 때만 지운다.
								const rect = view.dom.getBoundingClientRect();
								if (
									event.clientX < rect.left ||
									event.clientX > rect.right ||
									event.clientY < rect.top ||
									event.clientY > rect.bottom
								)
									setDropIndicator(view, null);
							}
							return false;
						},
						dragend(view) {
							endBlockDrag(view);
							return false;
						},
					},
					handleDrop(view, event, slice) {
						const viewAny = view as unknown as {
							dragging?: { cmsBlockPos?: number; cmsBlockEnd?: number; slice?: Slice };
						};
						const dragging = viewAny.dragging;
						const cmsBlockPos = dragging?.cmsBlockPos;
						const cmsBlockEnd = dragging?.cmsBlockEnd;

						// 블록 핸들 드래그가 아닌 일반 파일/텍스트 드롭은 기본 동작에 맡김
						if (cmsBlockPos === undefined) {
							return false;
						}

						event.preventDefault();

						try {
							const coords = { left: event.clientX, top: event.clientY };
							const target = view.posAtCoords(coords);
							if (!target) {
								return true;
							}

							const validDropPos = calculateDropPosition(
								view.state.doc,
								cmsBlockPos,
								target.pos,
								slice || dragging?.slice,
								cmsBlockEnd,
							);

							// 스키마가 허용하지 않는 위치면 드롭을 무시한다 (원문/문서 불변)
							if (validDropPos === null) {
								return true;
							}

							// 단일 트랜잭션으로 이동을 수행하여 단 1회의 Undo를 보장한다
							const tr = moveBlockNode(view.state, cmsBlockPos, validDropPos, cmsBlockEnd);
							if (tr) {
								view.dispatch(tr);
								view.focus();
							}
							return true;
						} finally {
							endBlockDrag(view);
						}
					},
				},
			}),
		];
	},
});
