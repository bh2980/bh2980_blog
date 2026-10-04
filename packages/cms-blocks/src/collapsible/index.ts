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
 * 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@bh2980/cms/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 */
export const collapsible = () =>
	definePlugin({
		name: "collapsible",
		options: {},
		blocks: [collapsibleBlock],
		admin: () => import("@bh2980/cms-blocks/collapsible/admin"),
		render: () => import("@bh2980/cms-blocks/collapsible/render"),
	});
