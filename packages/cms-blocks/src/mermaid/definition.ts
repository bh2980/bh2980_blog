import { defineBlock } from "@bh2980/cms";

/** Mermaid 다이어그램(` ```mermaid `). 편집기 미리보기는 확장이(사이트가 바꿀 수 있다), 공개 화면은 사이트가 그린다. */
export const mermaidBlock = defineBlock({
	name: "mermaid",
	label: "다이어그램",
	description: "Mermaid 다이어그램·흐름도",
	syntax: { kind: "fence", lang: "mermaid" },
	component: "Mermaid",
	attributes: {},
	editor: {
		view: "node",
		insertable: true,
		keywords: ["mermaid", "다이어그램", "흐름도"],
		icon: "workflow",
		placeholder: "Mermaid 다이어그램을 입력하세요",
		insert: { code: "graph TD\n  A --> B" },
	},
});
