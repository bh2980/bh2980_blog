import { aiAction, aiInput, defineAiCheck } from "@bh2980/cms-ai";

/**
 * Mermaid 블록의 AI 기능(`@bh2980/cms-ai`를 쓰는 사이트만). `aiPlugin({ actions })`에 이름을 붙여 넣는다.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() } })
 * ```
 */

const lines = (...text: string[]) => text.join("\n");

/** Mermaid가 아는 다이어그램 종류(첫 줄의 첫 낱말). */
const DIAGRAM_TYPES = new Set([
	"graph",
	"flowchart",
	"sequenceDiagram",
	"classDiagram",
	"stateDiagram",
	"stateDiagram-v2",
	"erDiagram",
	"journey",
	"gantt",
	"pie",
	"quadrantChart",
	"requirementDiagram",
	"gitGraph",
	"C4Context",
	"C4Container",
	"C4Component",
	"C4Dynamic",
	"C4Deployment",
	"mindmap",
	"timeline",
	"sankey-beta",
	"xychart-beta",
	"block-beta",
	"packet-beta",
	"architecture-beta",
	"kanban",
]);

/**
 * 코드 검사: 답이 ```mermaid 코드 펜스 하나이고, 첫 줄이 Mermaid가 아는 다이어그램 종류인가.
 * 그림을 실제로 그려 보는 검사는 브라우저(미리보기)가 한다.
 */
export function validateMermaid(value: string): string | undefined {
	const match = value.trim().match(/^```mermaid[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return "```mermaid 코드 펜스 하나가 아닙니다.";
	const first = (match[1] ?? "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("%%"));
	if (!first) return "다이어그램이 비었습니다.";
	const type = first.split(/\s+/)[0] ?? "";
	return DIAGRAM_TYPES.has(type) ? undefined : `알 수 없는 다이어그램 종류입니다: ${type}`;
}

/** 결과 문법 검사(코드 검사). 다른 기능에도 `checks`로 넣을 수 있다. */
export const mermaidSyntax = defineAiCheck({ name: "mermaid-syntax", label: "Mermaid 문법", run: validateMermaid });

export const mermaidAi = {
	/** 다이어그램 만들기. 슬래시 메뉴에서 요청을 받아 커서 자리에 Mermaid 블록을 넣는다. */
	draft: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "다이어그램 만들기",
			input: { title: aiInput.text({ label: "제목" }), body: aiInput.mdx({ label: "지금 본문" }) },
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"요청과 글의 제목·본문을 보고 Mermaid 다이어그램 하나를 만든다.",
					"- 답은 ```mermaid 코드 펜스 하나만 쓴다. 펜스 밖에는 아무것도 쓰지 않는다",
					"- 요청에 맞는 종류(flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt 등)를 고른다",
					"- 노드 글자는 본문과 같은 언어로 쓰고, 괄호·따옴표·쉼표가 든 글자는 큰따옴표로 감싼다",
					"- 본문에 없는 사실은 지어내지 않는다",
				),
			checks: [mermaidSyntax],
			attach: [{ slot: "insert" }],
		}),

	/** 다이어그램 고치기. 블록 손잡이 옆에서 요청대로 고치고, 바뀐 곳을 보인 뒤 블록을 바꾼다. */
	edit: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "다이어그램 고치기",
			input: { block: aiInput.mdx({ label: "다이어그램", required: true }), title: aiInput.text({ label: "제목" }) },
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"Mermaid 다이어그램(```mermaid 코드 펜스)을 요청대로 고친다.",
					"- 답은 고친 ```mermaid 코드 펜스 하나만 쓴다. 펜스 밖에는 아무것도 쓰지 않는다",
					"- 요청과 상관없는 부분은 그대로 둔다",
					"- 요청이 없으면 문법 오류를 고치고 알아보기 쉽게 정리한다",
				),
			checks: [mermaidSyntax],
			attach: [{ slot: "block", block: "mermaid" }],
		}),
};
