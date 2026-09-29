import { Mark, mergeAttributes, Node } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow, TableView } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { CmsCodeBlock } from "./code-block";
import { CodeFoldMark } from "./code-block/code-fold-mark";

/**
 * Tiptap 스키마에 없는 CMS 블록(수식·차트·콜아웃·탭·머메이드·병합된 표 등)을 보존하는 읽기 전용 상자.
 *
 * `attrs.source`에 그 서브트리의 저장 문자열(MDX)을 담는다. 저장할 때는 상자를 다시
 * 파싱해 끼워 넣으므로 내용이 바뀌지 않는다(§4.4 "조용히 노드를 삭제하지 않는다").
 * `atom`이라 상자 안은 편집되지 않고, 상자째로 선택·삭제만 된다.
 */
export const CmsOpaqueBlock = Node.create({
	name: "cmsOpaqueBlock",
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,
	addAttributes() {
		return {
			source: { default: "" },
			label: { default: "원문 블록" },
		};
	},
	parseHTML() {
		return [
			{
				tag: "div[data-cms-opaque]",
				getAttrs: (element) => ({
					source: element.getAttribute("data-source") ?? "",
					label: element.getAttribute("data-label") ?? "원문 블록",
				}),
			},
		];
	},
	renderHTML({ node }) {
		const source = String(node.attrs.source ?? "");
		const label = String(node.attrs.label ?? "원문 블록");
		return [
			"div",
			{
				"data-cms-opaque": "",
				"data-source": source,
				"data-label": label,
				class:
					"my-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900",
			},
			["div", { class: "text-xs font-medium text-neutral-500 dark:text-neutral-400" }, `${label} · 원문 모드에서 편집`],
			["pre", { class: "mt-2 overflow-x-auto whitespace-pre-wrap text-xs" }, source],
		];
	},
});

/** `:tooltip[라벨]{content="설명"}`의 에디터 표현. 점선 밑줄 span으로 보인다. */
export const CmsTooltipMark = Mark.create({
	name: "cmsTooltip",
	addAttributes() {
		return {
			content: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-cms-tooltip") ?? "",
			},
		};
	},
	parseHTML() {
		return [{ tag: "span[data-cms-tooltip]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["span", mergeAttributes(HTMLAttributes, { class: "underline decoration-dotted underline-offset-4" }), 0];
	},
});

/**
 * 본문 글자와 코드 줄의 연결(`:code-ref[글자]{to="c1"}`). `to`는 코드 블록 줄 이름표(`anchor` 줄 효과)의 `id`다.
 * 연결 글자 뒤에 이어 친 글자까지 연결되지 않게 `inclusive`를 끈다.
 */
export const CmsCodeRefMark = Mark.create({
	name: "codeRef",
	inclusive: false,
	addAttributes() {
		return {
			to: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-code-ref") ?? "",
				renderHTML: (attrs) => ({ "data-code-ref": String(attrs.to ?? "") }),
			},
		};
	},
	parseHTML() {
		return [{ tag: "span[data-code-ref]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(HTMLAttributes, {
				class: "underline decoration-primary/60 decoration-solid underline-offset-4",
			}),
			0,
		];
	},
});

/**
 * 새 표현 계약(§4.4)의 인라인·정렬 확장.
 *
 * 배치 3(M8-ED-2)에서 쓰기 명령을 켰다 — 에디터가 `toDocument`/`serialize` 경로로
 * 저장하므로 읽기/쓰기 전환이 원자적이다(§9.1.1·§9.1.3).
 *
 * A4: `alignments`에 `justify`를 넣지 않는다. 공개 렌더가 `left`·`center`·`right`만 고정 클래스로 지원한다.
 * Tiptap 내부는 인라인 `style`을 쓰지만(확장 기본 동작) 저장 형식은 `:::text-align{align=...}`이다.
 */
export const CmsTextAlign = TextAlign.configure({
	types: ["heading", "paragraph"],
	alignments: ["left", "center", "right"],
	defaultAlignment: null,
});

export const CmsSuperscript = Superscript;
export const CmsSubscript = Subscript;

/**
 * 코드 펜스 정보 문자열(` ```ts title="..." `)의 `meta`와 주석(밑줄·툴팁)을 들고 다닌다.
 * StarterKit의 코드블록에는 `language`만 있어 `meta`가 조용히 사라지므로,
 * StarterKit에서는 끄고(`codeBlock: false`) 이 확장을 쓴다.
 */
export { CmsCodeBlock };

/**
 * 열 너비를 끄는 동안에는 저장된 너비로 되돌리지 않는 표 NodeView.
 * 기본 TableView는 다시 그릴 때마다(`update`) 저장된 열 너비를 다시 적용한다. 끄는 너비는 DOM에만 있어서,
 * 끄는 도중 편집기가 다시 그려지면(React 재렌더로 옵션이 다시 설정될 때 등) 저장값과 번갈아 깜빡인다.
 * 놓으면 prosemirror-tables가 너비를 문서에 넣고, 그 뒤의 다시 그리기는 평소대로 적용한다.
 */
class CmsTableView extends TableView {
	private readonly editorView?: EditorView;

	constructor(node: PmNode, cellMinWidth: number, view?: EditorView, HTMLAttributes?: Record<string, unknown>) {
		super(node, cellMinWidth, view, HTMLAttributes);
		this.editorView = view;
	}

	update(node: PmNode): boolean {
		if (node.type !== this.node.type) return false;
		if (this.editorView && columnResizingPluginKey.getState(this.editorView.state)?.dragging) {
			this.node = node;
			return true;
		}
		const updated = super.update(node);
		this.clearStaleColumnWidths(node);
		return updated;
	}

	/**
	 * 너비가 없는 열의 `<col>`에 남은 옛 `width`를 지운다. Tiptap의 열 갱신은 너비가 없는 열에 `min-width`만
	 * 넣고 `width`는 그대로 둔다. 그래서 "폭 채우기" 뒤에도 옛 너비로 보이다가, 끌기 시작하면
	 * prosemirror-tables가 옛 너비를 한꺼번에 지워 표가 훅 바뀐다.
	 */
	private clearStaleColumnWidths(node: PmNode) {
		const row = node.firstChild;
		if (!row) return;
		const widths: Array<number | undefined> = [];
		row.forEach((cell) => {
			const { colspan, colwidth } = cell.attrs as { colspan: number; colwidth: number[] | null };
			for (let index = 0; index < colspan; index += 1) widths.push(colwidth?.[index] || undefined);
		});
		Array.from(this.colgroup.children).forEach((col, index) => {
			if (!widths[index] && col instanceof HTMLElement && col.style.width) col.style.width = "";
		});
	}
}

/**
 * 표(§4.1 "기본 표와 행·열 추가/삭제", v2 C6 셀 병합·열 너비).
 * 열 너비를 조절한 표는 `::::table{widths="..."}` directive로 저장한다(c-editor.md §1.2).
 * 열 경계 양옆 `handleWidth`(px) 안에서 끌면 너비를 조절한다. 기본 5px은 잡기 어려워 넓혔다.
 */
export const CmsTable = Table.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			// GFM 열 정렬(`:-:` 등)을 들고 다닌다. 화면에는 쓰지 않고 저장할 때만 쓴다.
			align: { default: null, rendered: false },
		};
	},
	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			// 열 너비를 끄는 동안에는 선택만 바꾸는 트랜잭션을 막는다. prosemirror-tables의 너비 조절 mousedown은
			// 처리했다고 알리지 않아 셀 선택(tableEditing)도 함께 시작된다. 끄다가 다른 셀(특히 위아래 행)로
			// 넘어가면 셀 선택이 바뀌고, 그때마다 표가 저장된 너비로 다시 그려져 끄는 너비와 번갈아 깜빡인다.
			new Plugin({
				key: new PluginKey("cmsTableResizeSelectionGuard"),
				filterTransaction: (tr, state) =>
					tr.docChanged || !tr.selectionSet || !columnResizingPluginKey.getState(state)?.dragging,
			}),
		];
	},
}).configure({ resizable: true, allowTableNodeSelection: true, handleWidth: 10, View: CmsTableView });

/** `- [ ]`·`- [x]` 체크 목록(§4.1). */
export const CmsTaskItem = TaskItem.configure({ nested: true });

export const CMS_SCHEMA_EXTENSIONS = [
	CmsTable,
	TableRow,
	TableHeader,
	TableCell,
	TaskList,
	CmsTaskItem,
	CmsTextAlign,
	CmsSuperscript,
	CmsSubscript,
	CmsTooltipMark,
	CmsCodeRefMark,
	CmsOpaqueBlock,
	CodeFoldMark,
	CmsCodeBlock,
];
