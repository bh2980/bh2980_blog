import type { Editor, Range } from "@tiptap/core";

export const OPEN_IMAGE_DIALOG_EVENT = "cms:open-image-dialog";

export type BlockInsertAction = (editor: Editor, range: Range) => void;

/**
 * 블록 정의(v2 B3)의 `editor.nodeView` 이름 → 슬래시 메뉴 삽입 액션 등록부(v2 C3a).
 *
 * `editor.insertable === true`이고 `editor.view === 'node'`인 블록 중 여기에 액션이 등록된 것이
 * 슬래시 메뉴에 자동으로 나타난다.
 * C3b가 콜아웃 등 컨테이너 블록을 추가할 때도 이 표에 한 줄로 등록한다.
 */
export const BLOCK_INSERT_ACTIONS: Record<string, BlockInsertAction> = {
	image: (editor, range) => {
		editor.chain().focus().deleteRange(range).run();
		window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
	},
	mermaid: (editor, range) => {
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsMermaid",
				attrs: {
					value: "graph TD\n  A --> B",
					language: "mermaid",
				},
			})
			.run();
	},
	chart: (editor, range) => {
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsChart",
				attrs: {
					value: [
						"chart bar",
						"x month",
						"series views | 조회수 | chart-1",
						"",
						"data",
						"month | views",
						"Jan | 1200",
					].join("\n"),
					language: "chart",
				},
			})
			.run();
	},
	callout: (editor, range) =>
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsCallout",
				attrs: { values: { variant: "info" } },
				content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
			})
			.run(),
	collapsible: (editor, range) =>
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsCollapsible",
				attrs: { values: { title: "접기 제목" } },
				content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
			})
			.run(),
	tabs: (editor, range) =>
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsTabs",
				content: ["첫 번째", "두 번째"].map((label) => ({
					type: "cmsTab",
					attrs: { values: { label } },
					content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
				})),
			})
			.run(),
	columns: (editor, range) =>
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsColumns",
				content: Array.from({ length: 2 }, () => ({
					type: "cmsColumn",
					content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
				})),
			})
			.run(),
	math: (editor, range) => {
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsMath",
				attrs: {
					value: "E = mc^2",
				},
			})
			.run();
	},
};
