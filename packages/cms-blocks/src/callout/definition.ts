import { defineBlock } from "@bh2980/cms";

/** 콜아웃(`:::callout{variant="tip" title="…"}`). 참고·경고처럼 눈에 띄게 강조하는 상자다. */
export const calloutBlock = defineBlock({
	name: "callout",
	label: "콜아웃",
	description: "참고·경고처럼 눈에 띄게 강조하는 상자",
	syntax: { kind: "container", directive: "callout" },
	component: "Callout",
	attributes: {
		variant: {
			type: "string",
			label: "종류",
			options: { note: "노트", tip: "팁", info: "정보", warning: "경고", danger: "위험" },
			defaultValue: "note",
		},
		title: { type: "string", label: "제목", translatable: true },
	},
	// 제목만 있는 콜아웃도 된다.
	children: { min: 0 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		keywords: ["callout", "콜아웃", "알림"],
		icon: "message-square-warning",
		insert: { values: { variant: "info" }, text: "내용을 입력하세요" },
	},
});
