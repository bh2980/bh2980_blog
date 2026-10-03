import { defineBlock } from "@bh2980/cms";

/** 차트(` ```chart `). 차트 문법은 `parseChartDsl`이 읽고, 편집기 미리보기와 공개 화면은 사이트가 그린다. */
export const chartBlock = defineBlock({
	name: "chart",
	label: "차트",
	description: "차트·그래프",
	syntax: { kind: "fence", lang: "chart" },
	component: "Chart",
	attributes: {},
	editor: {
		view: "node",
		insertable: true,
		keywords: ["chart", "차트", "그래프"],
		icon: "chart-column",
		placeholder: "차트 데이터를 입력하세요",
		insert: {
			code: ["chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | views", "Jan | 1200"].join(
				"\n",
			),
		},
	},
});
