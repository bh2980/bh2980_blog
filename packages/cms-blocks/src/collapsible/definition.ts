import { defineBlock } from "@bh2980/cms";

/** 접기(`:::collapsible{title="…"}`). 제목을 눌러 펼치는 영역이다. */
export const collapsibleBlock = defineBlock({
	name: "collapsible",
	label: "접기",
	description: "제목을 눌러 펼치는 영역",
	syntax: { kind: "container", directive: "collapsible" },
	component: "Collapsible",
	attributes: {
		title: { type: "string", label: "제목", translatable: true },
		defaultOpen: { type: "boolean", label: "처음부터 펼치기", defaultValue: false },
	},
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		keywords: ["collapsible", "접기", "펼치기"],
		icon: "chevrons-up-down",
		insert: { values: { title: "접기 제목" }, text: "내용을 입력하세요" },
	},
});
