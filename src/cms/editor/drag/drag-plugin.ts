import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { calculateDropPosition, moveBlockNode } from "./drag-commands";

export const BLOCK_DRAG_MIME_TYPE = "application/x-cms-block-drag";

export const cmsBlockDragPluginKey = new PluginKey("cmsBlockDrag");

/**
 * 블록 핸들 dragstart 시 호출되어 ProseMirror 드래그 상태와 dataTransfer를 초기화한다.
 */
export function startBlockDrag(
	view: EditorView,
	pos: number,
	event: React.DragEvent<HTMLElement> | DragEvent,
): boolean {
	const { state } = view;
	const node = state.doc.nodeAt(pos);
	if (!node) return false;

	// 노드 선택(NodeSelection)이 가능하면 선택 영역으로 지정한다
	let selection = state.selection;
	if (NodeSelection.isSelectable(node)) {
		selection = NodeSelection.create(state.doc, pos);
		view.dispatch(state.tr.setSelection(selection));
	}

	const slice = selection instanceof NodeSelection ? selection.content() : new Slice(Fragment.from(node), 0, 0);

	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", node.textContent);
		try {
			event.dataTransfer.setData(BLOCK_DRAG_MIME_TYPE, JSON.stringify({ pos, type: node.type.name }));
		} catch {
			// 일부 브라우저 제한 시 무시
		}
	}

	// ProseMirror 기본 드래그 객체(Dropcursor 및 drop 핸들러에서 참조) 설정
	(view as unknown as { dragging: unknown }).dragging = {
		slice,
		move: true,
		node: selection instanceof NodeSelection ? selection : undefined,
		cmsBlockPos: pos,
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
			new Plugin({
				key: cmsBlockDragPluginKey,
				props: {
					handleDOMEvents: {
						dragover(view, event) {
							const viewAny = view as unknown as { dragging?: { cmsBlockPos?: number; slice?: Slice } };
							const dragging = viewAny.dragging;
							if (dragging && dragging.cmsBlockPos !== undefined && event.dataTransfer) {
								const coords = { left: event.clientX, top: event.clientY };
								const target = view.posAtCoords(coords);
								if (target) {
									const validPos = calculateDropPosition(
										view.state.doc,
										dragging.cmsBlockPos,
										target.pos,
										dragging.slice,
									);
									if (validPos === null) {
										event.dataTransfer.dropEffect = "none";
										return false;
									}
									event.dataTransfer.dropEffect = "move";
								}
							}
							return false;
						},
						dragend(view) {
							endBlockDrag(view);
							return false;
						},
					},
					handleDrop(view, event, slice) {
						const viewAny = view as unknown as { dragging?: { cmsBlockPos?: number; slice?: Slice } };
						const dragging = viewAny.dragging;
						const cmsBlockPos = dragging?.cmsBlockPos;

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
							);

							// 스키마가 허용하지 않는 위치면 드롭을 무시한다 (원문/문서 불변)
							if (validDropPos === null) {
								return true;
							}

							// 단일 트랜잭션으로 이동을 수행하여 단 1회의 Undo를 보장한다
							const tr = moveBlockNode(view.state, cmsBlockPos, validDropPos);
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
