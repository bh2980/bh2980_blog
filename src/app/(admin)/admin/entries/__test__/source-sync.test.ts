import { describe, expect, it } from "vitest";
import { blockIndexOf, blocksOf, syncOffset } from "../source-sync";

const boxes = (...tops: number[]) => tops.map((top, i) => ({ top, bottom: tops[i + 1] ?? top + 100 }));

describe("syncOffset", () => {
	// 편집기 블록: 100–200, 200–400, 400–500 / 원문 블록: 300–350, 350–450, 450–550
	const editorBlocks = [
		{ top: 100, bottom: 200 },
		{ top: 200, bottom: 400 },
		{ top: 400, bottom: 500 },
	];
	const paneBlocks = [
		{ top: 300, bottom: 350 },
		{ top: 350, bottom: 450 },
		{ top: 450, bottom: 550 },
	];

	it("기준선이 걸린 블록의 같은 지점이 원문 창 기준선에 오도록 옮긴다", () => {
		// 기준선 300은 둘째 블록의 절반. 원문 둘째 블록의 절반(400)이 기준선 60에 온다.
		expect(syncOffset({ editorBlocks, editorLine: 300, paneBlocks, paneLine: 60, paneScrollTop: 20 })).toBe(
			20 + 400 - 60,
		);
	});

	it("블록 수가 다르면 마지막 블록에 맞춘다", () => {
		const short = paneBlocks.slice(0, 2);
		// 셋째 블록(400–500)의 시작에서 원문은 마지막(둘째) 블록의 시작에 맞춘다.
		expect(syncOffset({ editorBlocks, editorLine: 400, paneBlocks: short, paneLine: 50, paneScrollTop: 0 })).toBe(
			350 - 50,
		);
	});

	it("끝을 지난 기준선은 마지막 블록의 끝으로 본다", () => {
		expect(syncOffset({ editorBlocks, editorLine: 900, paneBlocks, paneLine: 0, paneScrollTop: 0 })).toBe(550);
	});

	it("첫 블록보다 위(제목 영역)면 그 간격을 두고 첫 블록 자리를 맞춘다", () => {
		// 기준선이 첫 블록 30px 위: 원문 첫 블록 위 30px이 기준선에 오도록 한다.
		expect(syncOffset({ editorBlocks, editorLine: 70, paneBlocks, paneLine: 48, paneScrollTop: 0 })).toBe(
			300 - 30 - 48,
		);
		// 음수는 0으로 막는다.
		expect(syncOffset({ editorBlocks, editorLine: 0, paneBlocks, paneLine: 300, paneScrollTop: 0 })).toBe(0);
	});

	it("맞출 블록이 없으면 null이다", () => {
		expect(syncOffset({ editorBlocks: [], editorLine: 0, paneBlocks, paneLine: 0, paneScrollTop: 0 })).toBeNull();
		expect(syncOffset({ editorBlocks, editorLine: 0, paneBlocks: [], paneLine: 0, paneScrollTop: 0 })).toBeNull();
		expect(boxes(0, 10)).toHaveLength(2);
	});
});

describe("최상위 블록 찾기", () => {
	const root = document.createElement("div");
	root.innerHTML =
		'<p>하나<strong>굵게</strong></p><div class="ProseMirror-gapcursor"></div><ul><li>목록</li></ul><br class="ProseMirror-trailingBreak">';
	document.body.append(root);

	it("자리 표시 요소는 블록으로 세지 않는다", () => {
		expect(blocksOf(root).map((block) => block.tagName)).toEqual(["P", "UL"]);
	});

	it("안쪽 노드에서 그 노드가 든 최상위 블록의 순서를 찾는다", () => {
		expect(blockIndexOf(root, root.querySelector("strong")?.firstChild ?? null)).toBe(0);
		expect(blockIndexOf(root, root.querySelector("li"))).toBe(1);
		expect(blockIndexOf(root, document.body)).toBeNull();
		expect(blockIndexOf(root, null)).toBeNull();
	});
});
