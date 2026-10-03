// AI 플러그인은 고를 수 있는 의존성이라 타입만 읽는다(블록 확장은 AI 플러그인 코드를 불러오지 않는다).
import type { AiActionDefinition, AiContribution, AiValidator } from "@bh2980/cms-ai";

/**
 * Mermaid 블록의 AI 기능(`@bh2980/cms-ai`를 쓰는 사이트만). `mermaid()` 플러그인이 `contributes.ai`로 더하므로 AI 플러그인을
 * 쓰는 사이트에는 저절로 붙는다(`diagramDraft`·`diagramEdit`). 지시문을 바꾸려면 같은 이름으로 적고, 끄려면 `false`를 준다.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 */

const lines = (...text: string[]) => text.join("\n");

/** 코드 검사(`@bh2980/cms-ai`의 `defineValidator`와 같은 모양). */
const codeCheck = (check: Omit<AiValidator, "kind">): AiValidator => ({ kind: "code", ...check });

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
export const mermaidSyntax = codeCheck({ name: "mermaid-syntax", label: "Mermaid 문법", run: validateMermaid });

/** 가짜 연결(개발 전용)의 답: 문법 검사를 통과하는 다이어그램. 고칠 다이어그램이 있으면 노드 한 줄을 더한다. */
function fakeMermaid(input: Readonly<Record<string, string>>): string {
	const fence = input.block?.trim().match(/^(```mermaid[^\n]*\n[\s\S]*?)\n?(```)$/);
	if (fence) return `${fence[1]}\n  fake["(fake)"]\n${fence[2]}`;
	const title = (input.title?.trim() || "다이어그램").replaceAll('"', "'");
	return `\`\`\`mermaid\ngraph TD\n  fake["(fake) ${title}"]\n\`\`\``;
}

export const mermaidAi = {
	/** 다이어그램 만들기. 슬래시 메뉴에서 요청을 받아 커서 자리에 Mermaid 블록을 넣는다. */
	draft: (options: { readonly prompt?: string } = {}) =>
		({
			label: "다이어그램 만들기",
			input: { title: { kind: "text", label: "제목" }, body: { kind: "mdx", label: "지금 본문" } },
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
			fake: fakeMermaid,
			attach: [{ slot: "insert" }],
		}) as const satisfies AiActionDefinition,

	/** 다이어그램 고치기. 블록 손잡이 옆에서 요청대로 고치고, 바뀐 곳을 보인 뒤 블록을 바꾼다. */
	edit: (options: { readonly prompt?: string } = {}) =>
		({
			label: "다이어그램 고치기",
			input: { block: { kind: "mdx", label: "다이어그램", required: true }, title: { kind: "text", label: "제목" } },
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
			fake: fakeMermaid,
			attach: [{ slot: "block", block: "mermaid" }],
		}) as const satisfies AiActionDefinition,
};

/** `mermaid()`이 AI 플러그인에 더하는 것. 기능 이름은 관리자 AI 화면에서 고친 값의 키다. */
export const mermaidAiContribution = {
	actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() },
} satisfies AiContribution;
