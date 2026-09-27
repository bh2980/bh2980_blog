import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { calculateDropPosition, canDropBlockNode, moveBlockNode } from "../drag-commands";

const createTestEditor = (content: string) => {
	return new Editor({
		extensions: buildEditorExtensions(),
		content,
	});
};

describe("블록 드래그 앤 드롭 순수 명령(v2 C1)", () => {
	it("최상위 블록 이동: 문단 순서를 재배치하고 한 번의 undo로 복구된다", () => {
		const editor = createTestEditor("<p>첫 번째</p><p>두 번째</p><p>세 번째</p>");
		const state = editor.state;

		// 첫 번째 블록 (0..7)
		const fromPos = 0;
		// 세 번째 블록 뒤 (끝 위치)
		const targetPos = state.doc.content.size;

		const tr = moveBlockNode(state, fromPos, targetPos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["두 번째", "세 번째", "첫 번째"]);

		// 한 드래그 = 한 undo 검증
		editor.commands.undo();
		expect(editor.state.doc.content.content.map((n) => n.textContent)).toEqual(["첫 번째", "두 번째", "세 번째"]);

		editor.destroy();
	});

	it("원자 노드(이미지/원문 상자 등)도 블록 단위로 이동 가능하다", () => {
		const editor = createTestEditor(
			'<p>앞 단락</p><div data-cms-opaque="true" data-raw-source=":::callout\n내용\n:::" data-line-start="1"></div><p>뒤 단락</p>',
		);
		const state = editor.state;

		const p1 = state.doc.child(0);
		const opaqueNodePos = p1.nodeSize;

		// 원자 노드를 맨 앞으로 이동
		const tr = moveBlockNode(state, opaqueNodePos, 0);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		expect(editor.state.doc.child(0).type.name).toBe("cmsOpaqueBlock");
		expect(editor.state.doc.child(1).textContent).toBe("앞 단락");
		expect(editor.state.doc.child(2).textContent).toBe("뒤 단락");

		editor.destroy();
	});

	it("중첩 블록: 목록 항목(listItem)을 목록 내에서 이동할 수 있다", () => {
		const editor = createTestEditor("<ul><li><p>항목 1</p></li><li><p>항목 2</p></li><li><p>항목 3</p></li></ul>");
		const { doc } = editor.state;

		const list = doc.child(0);
		// 두 번째 listItem의 시작 위치
		const item1Size = list.child(0).nodeSize;
		const item2Pos = 1 + item1Size; // list 내부이므로 +1
		const item1Pos = 1; // 첫 번째 listItem 위치

		expect(canDropBlockNode(doc, item2Pos, item1Pos)).toBe(true);

		const tr = moveBlockNode(editor.state, item2Pos, item1Pos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		const updatedList = editor.state.doc.child(0);
		const texts = [
			updatedList.child(0).textContent,
			updatedList.child(1).textContent,
			updatedList.child(2).textContent,
		];
		expect(texts).toEqual(["항목 2", "항목 1", "항목 3"]);

		editor.destroy();
	});

	it("중첩 블록: 인용문(blockquote) 안의 단락을 이동하거나 인용문 밖으로 꺼낼 수 있다", () => {
		const editor = createTestEditor("<blockquote><p>인용 1</p><p>인용 2</p></blockquote><p>외부 단락</p>");
		const { doc } = editor.state;

		const blockquote = doc.child(0);
		const p1Size = blockquote.child(0).nodeSize;
		const p2Pos = 1 + p1Size;

		// 인용문 밖 최상위 문서 끝으로 이동
		const endPos = doc.content.size;
		expect(canDropBlockNode(doc, p2Pos, endPos)).toBe(true);

		const tr = moveBlockNode(editor.state, p2Pos, endPos);
		expect(tr).not.toBeNull();
		if (!tr) return;

		editor.view.dispatch(tr);
		const bq = editor.state.doc.child(0);
		expect(bq.childCount).toBe(1);
		expect(bq.child(0).textContent).toBe("인용 1");
		expect(editor.state.doc.child(2).textContent).toBe("인용 2");

		editor.destroy();
	});

	it("스키마가 허용하지 않는 위치는 드롭을 거부한다 (canReplace/contentMatch 불가)", () => {
		const editor = createTestEditor(
			"<ul><li><p>목록</p></li></ul><pre><code>코드 블록 내용</code></pre><p>일반 문단</p>",
		);
		const { doc } = editor.state;

		// 1. listItem을 doc 루트(최상위)에 단독으로 놓는 것은 스키마가 거부해야 함
		const listItemPos = 1;
		const docRootEnd = doc.content.size;
		expect(canDropBlockNode(doc, listItemPos, docRootEnd)).toBe(false);
		expect(moveBlockNode(editor.state, listItemPos, docRootEnd)).toBeNull();

		// 2. 일반 문단을 codeBlock 내부에 자식 블록으로 넣는 것은 스키마가 거부해야 함
		const listSize = doc.child(0).nodeSize;
		const codeBlockPos = listSize;
		const paragraphPos = listSize + doc.child(1).nodeSize;
		const insideCodePos = codeBlockPos + 2; // codeBlock 텍스트 내부

		expect(canDropBlockNode(doc, paragraphPos, insideCodePos)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, insideCodePos)).toBeNull();

		// 3. 자기 자신 내부로의 이동 거부
		expect(canDropBlockNode(doc, paragraphPos, paragraphPos + 1)).toBe(false);
		expect(moveBlockNode(editor.state, paragraphPos, paragraphPos + 1)).toBeNull();

		editor.destroy();
	});

	it("calculateDropPosition: 텍스트 안으로 드롭된 경우 유효한 부모 블록 경계로 보정한다", () => {
		const editor = createTestEditor("<p>첫 번째 단락</p><p>두 번째 단락</p>");
		const { doc } = editor.state;

		const fromPos = 0; // 첫 번째 단락
		// 두 번째 단락 텍스트 후반부 위치
		const p1Size = doc.child(0).nodeSize;
		const secondHalfOfSecond = p1Size + 6;

		const dropPos = calculateDropPosition(doc, fromPos, secondHalfOfSecond);
		// 두 번째 단락 뒤 유효 지점(문서 끝)으로 보정되어야 함
		expect(dropPos).not.toBeNull();
		expect(dropPos).toBe(doc.content.size);

		// 반대로 두 번째 단락을 첫 번째 단락 전반부로 드롭 시 문서 시작(0)으로 보정
		const secondPos = p1Size;
		const dropPosFirst = calculateDropPosition(doc, secondPos, 2);
		expect(dropPosFirst).toBe(0);

		editor.destroy();
	});

	it("CmsBlockDrag 플러그인: 유효한 드롭은 문서를 이동시키고 허용 안 되는 드롭은 무시한다", () => {
		const editor = createTestEditor("<p>단락 1</p><pre><code>코드</code></pre><p>단락 2</p>");
		const { view } = editor;

		// 1. 단락 1을 단락 2 뒤로 드롭하는 케이스 (유효)
		(view as unknown as { dragging: unknown }).dragging = {
			slice: editor.state.doc.slice(0, editor.state.doc.child(0).nodeSize),
			move: true,
			cmsBlockPos: 0,
		};
		// jsdom에서 posAtCoords 모의
		view.posAtCoords = () => ({ pos: editor.state.doc.content.size, inside: editor.state.doc.content.size });

		const dropEvent = Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
			clientX: 100,
			clientY: 100,
			dataTransfer: {
				getData: () => "",
				setData: () => {},
				types: [],
			},
		});
		view.dom.dispatchEvent(dropEvent);

		// 단락 1이 끝으로 이동했는지 확인
		expect(editor.state.doc.child(2).textContent).toBe("단락 1");

		// 2. listItem을 doc 루트(최상위)로 드롭 시도 (허용 불가)
		const listEditor = createTestEditor("<ul><li><p>목록 항목 1</p></li></ul><p>일반 문단</p>");
		const listDoc = listEditor.state.doc;
		const listItemPos = 1;
		(listEditor.view as unknown as { dragging: unknown }).dragging = {
			slice: listDoc.slice(listItemPos, listItemPos + listDoc.child(0).child(0).nodeSize),
			move: true,
			cmsBlockPos: listItemPos,
		};
		const targetEndPos = listDoc.content.size;
		listEditor.view.posAtCoords = () => ({ pos: targetEndPos, inside: targetEndPos });

		const beforeDoc = listEditor.state.doc.toJSON();
		const invalidDropEvent = Object.assign(new Event("drop", { bubbles: true, cancelable: true }), {
			clientX: 50,
			clientY: 50,
			dataTransfer: {
				getData: () => "",
				setData: () => {},
				types: [],
			},
		});
		listEditor.view.dom.dispatchEvent(invalidDropEvent);

		// 스키마상 listItem을 doc 루트에 둘 수 없으므로 drop이 무시되어 문서가 그대로 유지됨
		expect(listEditor.state.doc.toJSON()).toEqual(beforeDoc);

		listEditor.destroy();

		editor.destroy();
	});
});
