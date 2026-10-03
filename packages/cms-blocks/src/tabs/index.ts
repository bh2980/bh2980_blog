import { definePlugin } from "@bh2980/cms";
import { tabBlock, tabsBlock } from "./definition";

export { tabBlock, tabsBlock } from "./definition";

/**
 * 탭 블록(`::::tabs` 안에 `:::tab` 2~8개). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [tabs()]
 * ```
 *
 * 공개 화면은 사이트가 `Tabs`·`Tab` 컴포넌트로 그린다.
 */
export const tabs = () =>
	definePlugin({
		name: "tabs",
		options: {},
		blocks: [tabsBlock, tabBlock],
		admin: () => import("@bh2980/cms-blocks/tabs/admin"),
	});
