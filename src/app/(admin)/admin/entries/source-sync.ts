import { type RefObject, useEffect } from "react";

/** 화면 위 블록의 세로 자리(뷰포트 기준). */
export interface BlockBox {
	readonly top: number;
	readonly bottom: number;
}

/** 원문 창에서 커서가 있는 블록에 붙이는 표시 이름. */
export const ACTIVE_BLOCK_CLASS = "cms-source-active";

/**
 * 번역 편집기의 기준선(도구줄 바로 아래)에 걸린 블록과 같은 블록이, 원문 창의 기준선에 오도록 하는 scrollTop.
 * 블록은 위에서부터 같은 순서로 대응한다(원문이 더 짧으면 마지막 블록). 기준선이 첫 블록보다 위(제목 영역)면
 * 그 간격을 그대로 두고 첫 블록 위치를 맞춘다. 맞출 블록이 없으면 `null`.
 */
export function syncOffset({
	editorBlocks,
	editorLine,
	paneBlocks,
	paneLine,
	paneScrollTop,
}: {
	editorBlocks: readonly BlockBox[];
	editorLine: number;
	paneBlocks: readonly BlockBox[];
	paneLine: number;
	paneScrollTop: number;
}): number | null {
	const first = editorBlocks[0];
	const paneFirst = paneBlocks[0];
	if (!first || !paneFirst) return null;

	let paneY: number;
	if (editorLine < first.top) {
		paneY = paneFirst.top - (first.top - editorLine);
	} else {
		const found = editorBlocks.findIndex((box) => box.bottom > editorLine);
		const index = found === -1 ? editorBlocks.length - 1 : found;
		const box = editorBlocks[index] ?? first;
		const height = box.bottom - box.top;
		const fraction = height > 0 ? Math.min(1, Math.max(0, (editorLine - box.top) / height)) : 0;
		const target = paneBlocks[Math.min(index, paneBlocks.length - 1)] ?? paneFirst;
		paneY = target.top + fraction * (target.bottom - target.top);
	}
	return Math.max(0, paneScrollTop + paneY - paneLine);
}

/** ProseMirror가 덧붙이는 자리 표시(커서·구분 요소)를 뺀 최상위 블록. */
const isBlock = (element: Element) =>
	!element.matches(".ProseMirror-gapcursor, .ProseMirror-separator, .ProseMirror-trailingBreak, br");

export const blocksOf = (root: Element | null | undefined): HTMLElement[] =>
	root ? (Array.from(root.children).filter(isBlock) as HTMLElement[]) : [];

const boxOf = (element: Element): BlockBox => {
	const rect = element.getBoundingClientRect();
	return { top: rect.top, bottom: rect.bottom };
};

/** `node`가 든 최상위 블록의 순서. 편집기 밖이면 `null`. */
export const blockIndexOf = (root: Element, node: Node | null): number | null => {
	if (!node || !root.contains(node) || node === root) return null;
	const blocks = blocksOf(root);
	const index = blocks.findIndex((block) => block.contains(node));
	return index === -1 ? null : index;
};

const PANE_RETRY_FRAMES = 30;

/**
 * 번역 편집기와 원문 창을 잇는다(v3). 편집기를 스크롤하면 같은 블록이 같은 높이에 오도록 원문 창을 옮기고
 * (반대 방향은 잇지 않는다), 편집기 커서가 있는 블록에 대응하는 원문 블록을 표시한다.
 */
export function useSourceSync({
	enabled,
	syncScroll,
	editorRef,
	paneRef,
}: {
	enabled: boolean;
	syncScroll: boolean;
	editorRef: RefObject<HTMLElement | null>;
	paneRef: RefObject<HTMLElement | null>;
}) {
	useEffect(() => {
		if (!enabled) return;
		let frame = 0;
		let retries = 0;

		const panePM = () => paneRef.current?.querySelector(".ProseMirror") ?? null;
		const editorPM = () => editorRef.current?.querySelector(".ProseMirror") ?? null;

		const scrollPane = () => {
			const editorEl = editorRef.current;
			const pane = paneRef.current;
			if (!syncScroll || !editorEl || !pane) return;
			const editorBlocks = blocksOf(editorPM());
			const paneBlocks = blocksOf(panePM());
			const toolbar = editorEl.querySelector('[role="toolbar"][aria-label="서식 도구"]');
			const header = pane.querySelector("[data-source-header]");
			const next = syncOffset({
				editorBlocks: editorBlocks.map(boxOf),
				editorLine: editorEl.getBoundingClientRect().top + (toolbar?.getBoundingClientRect().height ?? 0),
				paneBlocks: paneBlocks.map(boxOf),
				paneLine: pane.getBoundingClientRect().top + (header?.getBoundingClientRect().height ?? 0),
				paneScrollTop: pane.scrollTop,
			});
			if (next !== null && Math.abs(next - pane.scrollTop) >= 1) pane.scrollTop = next;
		};

		const markActive = () => {
			const root = editorPM();
			if (!root) return;
			const selection = document.getSelection();
			const index = blockIndexOf(root, selection?.anchorNode ?? null);
			// 커서가 편집기 밖(제목 입력 등)이면 표시를 그대로 둔다.
			if (index === null) return;
			blocksOf(panePM()).forEach((block, i) => {
				block.classList.toggle(ACTIVE_BLOCK_CLASS, i === index);
			});
		};

		const run = () => {
			frame = 0;
			scrollPane();
			markActive();
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(run);
		};

		// 원문 창의 편집기는 늦게 만들어진다. 블록이 생길 때까지 잠시 기다렸다가 처음 한 번 맞춘다.
		const waitForPane = () => {
			frame = 0;
			if (blocksOf(panePM()).length > 0 || retries >= PANE_RETRY_FRAMES) {
				run();
				return;
			}
			retries += 1;
			frame = requestAnimationFrame(waitForPane);
		};
		frame = requestAnimationFrame(waitForPane);

		const editorEl = editorRef.current;
		editorEl?.addEventListener("scroll", schedule, { passive: true });
		document.addEventListener("selectionchange", schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			editorEl?.removeEventListener("scroll", schedule);
			document.removeEventListener("selectionchange", schedule);
		};
	}, [enabled, syncScroll, editorRef, paneRef]);
}
