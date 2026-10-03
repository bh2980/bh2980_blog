import { definePlugin } from "@bh2980/cms";
import { chartAiContribution } from "./ai";
import { chartBlock } from "./definition";

export { chartBlock } from "./definition";

/**
 * 차트 블록(` ```chart `). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [chart()]
 * ```
 *
 * 편집기는 코드 입력 칸과 미리보기로 편집한다. 미리보기는 사이트가 `fencePreviews.chart`로, 공개 화면은 `Chart`
 * 컴포넌트로 그린다(코드는 `source` 속성, `remarkFenceBlocksToMdx`).
 */
export const chart = () =>
	definePlugin({
		name: "chart",
		options: {},
		blocks: [chartBlock],
		admin: () => import("@bh2980/cms-blocks/chart/admin"),
		// AI 플러그인이 있으면 만들기·고치기 기능이 저절로 붙는다(`./ai`).
		contributes: { ai: chartAiContribution },
	});

export * from "./dsl";
export * from "./types";
