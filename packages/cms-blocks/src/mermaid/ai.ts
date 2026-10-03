import { aiAction, aiInput } from "@bh2980/cms-ai";

/**
 * Mermaid 블록의 AI 기능(`@bh2980/cms-ai`를 쓰는 사이트만). `aiPlugin({ actions })`에 이름을 붙여 넣는다.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() } })
 * ```
 */

const lines = (...text: string[]) => text.join("\n");

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
			attach: [{ slot: "block", block: "mermaid" }],
		}),
};
