import { definePlugin } from "@bh2980/cms";
import { calloutBlock } from "./definition";

export { calloutBlock } from "./definition";

/**
 * 콜아웃 블록(`:::callout`). 참고·경고처럼 눈에 띄게 강조하는 상자다. 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [callout()]
 * ```
 *
 * 공개 화면은 사이트가 `Callout` 컴포넌트로 그린다.
 */
export const callout = () =>
	definePlugin({
		name: "callout",
		options: {},
		blocks: [calloutBlock],
		admin: () => import("@bh2980/cms-blocks/callout/admin"),
	});
