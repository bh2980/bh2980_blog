import { Mark, mergeAttributes, Node } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { CmsCodeBlock } from "./code-block";

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
 * GFM 표(§4.1 "기본 표와 행·열 추가/삭제"). 셀 병합은 v1 범위가 아니라 명령을 노출하지 않는다.
 * 열 너비 조절은 Markdown 표에 저장할 수 없어 끈다.
 */
export const CmsTable = Table.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			// GFM 열 정렬(`:-:` 등)을 들고 다닌다. 화면에는 쓰지 않고 저장할 때만 쓴다.
			align: { default: null, rendered: false },
		};
	},
}).configure({ resizable: false, allowTableNodeSelection: true });

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
	CmsOpaqueBlock,
	CmsCodeBlock,
];
