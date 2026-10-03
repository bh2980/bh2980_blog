import { definePlugin } from "@bh2980/cms";
import { columnBlock, columnsBlock } from "./definition";

export { columnBlock, columnsBlock } from "./definition";

/**
 * 단 나누기 블록(`::::columns` 안에 `:::column` 2~4개). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [columns()]
 * ```
 *
 * 공개 화면은 사이트가 `Columns`·`Column` 컴포넌트로 그린다.
 */
export const columns = () =>
	definePlugin({
		name: "columns",
		options: {},
		blocks: [columnsBlock, columnBlock],
		admin: () => import("@bh2980/cms-blocks/columns/admin"),
	});

export * from "./layout";
