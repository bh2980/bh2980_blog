import { defineBlock } from "@bh2980/cms";

/** 탭 묶음(`::::tabs` 안에 `:::tab{label="…"}` 2~8개). */
export const tabsBlock = defineBlock({
	name: "tabs",
	label: "탭",
	description: "여러 내용을 탭으로 나눠 보여 준다",
	syntax: { kind: "container", directive: "tabs" },
	component: "Tabs",
	attributes: {
		defaultValue: {
			type: "string",
			label: "처음 열 탭",
			description: "탭 이름 중 하나. 비우면 첫 탭이다.",
			childValue: "label",
		},
	},
	children: { blocks: ["tab"], min: 2, max: 8 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		keywords: ["tabs", "탭"],
		icon: "square-stack",
		insert: {
			children: [
				{ values: { label: "첫 번째" }, text: "내용을 입력하세요" },
				{ values: { label: "두 번째" }, text: "내용을 입력하세요" },
			],
		},
	},
});

export const tabBlock = defineBlock({
	name: "tab",
	label: "탭 하나",
	syntax: { kind: "container", directive: "tab" },
	component: "Tab",
	attributes: { label: { type: "string", label: "탭 이름", required: true, translatable: true } },
	parent: "tabs",
	translateInside: true,
	editor: { view: "node" },
});
