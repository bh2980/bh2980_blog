import { definePlugin } from "@bh2980/cms";
import { collapsibleBlock } from "./definition";

export { collapsibleBlock } from "./definition";

/**
 * 접기 블록(`:::collapsible`). 제목을 눌러 펼치는 영역이다. 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [collapsible()]
 * ```
 *
 * 공개 화면은 사이트가 `Collapsible` 컴포넌트로 그린다.
 */
export const collapsible = () =>
	definePlugin({
		name: "collapsible",
		options: {},
		blocks: [collapsibleBlock],
		admin: () => import("@bh2980/cms-blocks/collapsible/admin"),
	});
