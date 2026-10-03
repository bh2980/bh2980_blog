import { defineBlock } from "@bh2980/cms";

/** 단 나누기(`::::columns{widths="60,40"}` 안에 `:::column` 2~4개). */
export const columnsBlock = defineBlock({
	name: "columns",
	label: "단 나누기",
	description: "내용을 2~4단으로 나란히 놓는다",
	syntax: { kind: "container", directive: "columns" },
	component: "Columns",
	attributes: {
		widths: {
			type: "string",
			label: "단 너비",
			description: "단마다 비율(%)을 쉼표로 적는다(예: 60,40). 비우면 똑같이 나눈다.",
		},
	},
	children: { blocks: ["column"], min: 2, max: 4 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		keywords: ["columns", "단", "나란히"],
		icon: "columns-2",
		insert: { children: [{ text: "내용을 입력하세요" }, { text: "내용을 입력하세요" }] },
	},
});

export const columnBlock = defineBlock({
	name: "column",
	label: "단 하나",
	syntax: { kind: "container", directive: "column" },
	component: "Column",
	attributes: {},
	parent: "columns",
	translateInside: true,
	editor: { view: "node" },
});
