import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { MOVED_RANGE_META, sourceRangeOf } from "./drag-commands";

/**
 * 블록 선택(노션의 블록 선택). 글자 선택과 따로 둔다 — 글자를 끌어 고르면 글자만, 본문 바깥 여백에서
 * 끌어 네모 영역(마키)으로 고르면 블록이 통째로 선택된다. 보이는 것과 지워지는 것이 같아야 한다.
 *
 * 상태는 같은 부모 안의 이웃 블록 범위(from 앞 ~ to 뒤)다. 선택된 블록은 통째로 칠하고, 그 블록 중 하나의
 * 핸들을 끌면 전부 함께 옮긴다(startBlockDrag). Backspace·Delete는 블록째 지운다.
 * 복사가 되도록 ProseMirror 선택도 같은 범위의 글자 선택으로 맞춰 두되, 글자 선택 표시는 숨긴다.
 */
export type BlockRange = { from: number; to: number };

export const cmsBlockSelectionKey = new PluginKey<BlockRange | null>("cmsBlockSelection");

/** 여러 블록 선택 중인 편집기와 선택된 블록에 붙는 클래스(스타일은 편집기 클래스에 둔다). */
export const BLOCK_RANGE_CLASS = "cms-block-range";
export const BLOCK_SELECTED_CLASS = "cms-block-selected";

export const selectedBlockRange = (state: EditorState): BlockRange | null =>
	cmsBlockSelectionKey.getState(state) ?? null;

/** 블록 범위를 선택한다. 복사가 되도록 ProseMirror 선택도 그 범위의 글자로 맞춘다. */
export function setBlockSelection(tr: Transaction, range: BlockRange | null): Transaction {
	tr.setMeta(cmsBlockSelectionKey, range);
	if (range) {
		const start = tr.doc.resolve(Math.min(range.from + 1, tr.doc.content.size));
		const end = tr.doc.resolve(Math.max(range.to - 1, 0));
		tr.setSelection(TextSelection.between(start, end));
	}
	return tr;
}

const clearBlockSelection = (view: EditorView) => {
	if (selectedBlockRange(view.state)) view.dispatch(view.state.tr.setMeta(cmsBlockSelectionKey, null));
};

/** 선택된 블록을 통째로 지운다. 부모가 비면 안 되는 자리(문서 전체·컨테이너)는 빈 문단을 남긴다. */
export function deleteSelectedBlocks(state: EditorState): Transaction | null {
	const range = selectedBlockRange(state);
	if (!range) return null;
	const tr = state.tr;
	const source = sourceRangeOf(state.doc, range.from, range.to);
	const paragraph = state.schema.nodes.paragraph;
	if (source?.fill) tr.replaceWith(source.from, source.to, source.fill);
	else if (source) tr.delete(source.from, source.to);
	else if (paragraph) tr.replaceWith(range.from, range.to, paragraph.create());
	else return null;
	tr.setMeta(cmsBlockSelectionKey, null);
	tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tr.mapping.map(range.from), tr.doc.content.size))));
	return tr.scrollIntoView();
}

const decorationsFor = (state: EditorState) => {
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
};

/** 블록 선택 중 누른 키. 블록째 지우기·잘라내기, 나머지 입력은 부분 덮어쓰기를 막고 선택만 푼다. */
function handleBlockSelectionKey(view: EditorView, event: KeyboardEvent): boolean {
	if (!selectedBlockRange(view.state)) return false;
	const mod = event.metaKey || event.ctrlKey;
	if (event.key === "Backspace" || event.key === "Delete") {
		const tr = deleteSelectedBlocks(view.state);
		if (tr) view.dispatch(tr);
		return true;
	}
	if (mod && event.key.toLowerCase() === "x") {
		// 복사는 ProseMirror가 같은 범위의 글자 선택으로 처리한다. 지우기만 블록째 한다.
		document.execCommand("copy");
		const tr = deleteSelectedBlocks(view.state);
		if (tr) view.dispatch(tr);
		return true;
	}
	if (mod || event.key === "Shift" || event.key === "Alt" || event.key === "Meta" || event.key === "Control")
		return false; // 복사·실행 취소·전체 선택 등은 그대로 둔다
	if (event.key === "Escape") {
		clearBlockSelection(view);
		return true;
	}
	if (event.key.startsWith("Arrow")) {
		clearBlockSelection(view);
		return false;
	}
	// 글자·Enter 등: 여러 블록 글자를 부분적으로 덮어쓰지 않게 막고 선택만 푼다.
	clearBlockSelection(view);
	return true;
}

export function createBlockSelectionPlugin() {
	return new Plugin<BlockRange | null>({
		key: cmsBlockSelectionKey,
		state: {
			init: () => null,
			apply(tr, value) {
				const meta = tr.getMeta(cmsBlockSelectionKey) as BlockRange | null | undefined;
				if (meta !== undefined) return meta;
				const moved = tr.getMeta(MOVED_RANGE_META) as BlockRange | undefined;
				if (moved) return moved;
				if (!value) return null;
				// 다른 선택이 일어나면 블록 선택을 푼다(블록 선택은 마키·핸들 이동으로만 이어진다).
				if (tr.selectionSet) return null;
				// 선택과 무관한 문서 변경(끝 빈 문단 추가 등)은 위치만 따라간다.
				if (!tr.docChanged) return value;
				const from = tr.mapping.map(value.from, 1);
				const to = tr.mapping.map(value.to, -1);
				return to > from ? { from, to } : null;
			},
		},
		props: {
			attributes: (state): Record<string, string> => (selectedBlockRange(state) ? { class: BLOCK_RANGE_CLASS } : {}),
			decorations: decorationsFor,
			handleKeyDown: handleBlockSelectionKey,
			handleDOMEvents: {
				mousedown(view, event) {
					// 편집기 자체의 좌우 여백(본문 칸 바깥)을 누르면 마키 선택을 시작한다. 여기서 처리해야
					// ProseMirror가 같은 누름으로 글자 커서를 함께 옮기지 않는다.
					if (event.target === view.dom && isOutsideContentColumn(view, event.clientX)) {
						startMarquee(view, event);
						return true;
					}
					// 본문을 누르면(글자 선택을 시작하면) 블록 선택을 푼다.
					clearBlockSelection(view);
					return false;
				},
			},
		},
	});
}

const MARQUEE_THRESHOLD = 4;

/** 본문 칸(편집기 안쪽 여백을 뺀 영역)의 좌우 바깥인지. 마키 선택은 여기서만 시작한다. */
export function isOutsideContentColumn(view: EditorView, clientX: number): boolean {
	const rect = view.dom.getBoundingClientRect();
	const style = getComputedStyle(view.dom);
	const left = rect.left + (Number.parseFloat(style.paddingLeft) || 0);
	const right = rect.right - (Number.parseFloat(style.paddingRight) || 0);
	return clientX < left || clientX > right;
}

/**
 * 마키(네모 영역) 선택을 시작한다. 본문 바깥 여백에서 누른 채 끌면 네모를 그리고, 네모의 세로 범위에
 * 걸친 최상위 블록들을 선택한다(블록 사이를 건너뛰지 않고 첫~마지막 블록까지 이어서).
 * 조금만 움직이고 놓으면(클릭) 아무것도 하지 않는다.
 */
export function startMarquee(view: EditorView, event: MouseEvent): void {
	if (event.button !== 0) return;
	const startX = event.clientX;
	const startY = event.clientY;
	let box: HTMLDivElement | null = null;
	let moved = false;
	event.preventDefault();

	const blocksIn = (top: number, bottom: number): BlockRange | null => {
		let from: number | null = null;
		let to: number | null = null;
		view.state.doc.forEach((node, offset) => {
			const dom = view.nodeDOM(offset);
			if (!(dom instanceof HTMLElement)) return;
			const rect = dom.getBoundingClientRect();
			if (rect.bottom < top || rect.top > bottom) return;
			if (from === null) from = offset;
			to = offset + node.nodeSize;
		});
		return from !== null && to !== null ? { from, to } : null;
	};

	const move = (moveEvent: MouseEvent) => {
		const dx = moveEvent.clientX - startX;
		const dy = moveEvent.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < MARQUEE_THRESHOLD) return;
		moved = true;
		if (!box) {
			box = document.createElement("div");
			box.setAttribute("aria-hidden", "true");
			box.dataset.cmsMarquee = "";
			box.className = "pointer-events-none fixed z-50 rounded-sm border border-primary/60 bg-primary/10";
			document.body.appendChild(box);
		}
		const left = Math.min(startX, moveEvent.clientX);
		const top = Math.min(startY, moveEvent.clientY);
		box.style.left = `${left}px`;
		box.style.top = `${top}px`;
		box.style.width = `${Math.abs(dx)}px`;
		box.style.height = `${Math.abs(dy)}px`;
		const range = blocksIn(top, top + Math.abs(dy));
		const current = selectedBlockRange(view.state);
		if (range?.from !== current?.from || range?.to !== current?.to)
			view.dispatch(setBlockSelection(view.state.tr, range).setMeta("addToHistory", false));
	};

	const end = () => {
		window.removeEventListener("mousemove", move);
		window.removeEventListener("mouseup", end);
		box?.remove();
		if (!moved) return;
		// 끌기가 끝나며 생기는 click이 편집기 바깥 클릭(끝으로 이동)으로 처리되어 선택을 풀지 않게 한 번 삼킨다.
		const swallow = (clickEvent: MouseEvent) => {
			clickEvent.stopPropagation();
			clickEvent.preventDefault();
		};
		window.addEventListener("click", swallow, { capture: true, once: true });
		// click은 mouseup 바로 뒤에 온다. 오지 않았으면(영역 밖에서 놓음) 다음 클릭을 삼키지 않게 치운다.
		setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
		if (selectedBlockRange(view.state)) view.focus();
	};

	window.addEventListener("mousemove", move);
	window.addEventListener("mouseup", end);
}
