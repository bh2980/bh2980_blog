import { defineBlock } from "@bh2980/cms";

/**
 * 글자색·글자 배경색(`:color[글]{fg="#dc2626" fgDark="#f87171"}`). 헥스 값을 밝은·어두운 테마 짝으로 저장한다.
 * 고르기 목록과 값 검사는 `./colors`. 공개 화면은 사이트가 `Color` 컴포넌트로 그린다(`textColorProps`).
 */
export const colorBlock = defineBlock({
	name: "color",
	label: "글자색",
	syntax: { kind: "text", directive: "color" },
	component: "Color",
	attributes: {
		fg: { type: "string", label: "글자색" },
		fgDark: { type: "string", label: "어두운 테마 글자색" },
		bg: { type: "string", label: "배경색" },
		bgDark: { type: "string", label: "어두운 테마 배경색" },
	},
	editor: { view: "mark" },
});
