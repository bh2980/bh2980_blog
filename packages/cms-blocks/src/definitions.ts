/** 블록 정의(데이터)만. 플러그인 없이 사이트 설정의 `blocks`에 바로 넣을 때 쓴다. */
export { calloutBlock } from "./callout/definition";
export { chartBlock } from "./chart/definition";
export { collapsibleBlock } from "./collapsible/definition";
export { columnBlock, columnsBlock } from "./columns/definition";
export { mermaidBlock } from "./mermaid/definition";
export { tabBlock, tabsBlock } from "./tabs/definition";

import { calloutBlock } from "./callout/definition";
import { chartBlock } from "./chart/definition";
import { collapsibleBlock } from "./collapsible/definition";
import { columnBlock, columnsBlock } from "./columns/definition";
import { mermaidBlock } from "./mermaid/definition";
import { tabBlock, tabsBlock } from "./tabs/definition";

/** 이 패키지의 블록 정의 전부(콜아웃·접기·탭·단·Mermaid·차트 순서). */
export const ALL_BLOCKS = [
	calloutBlock,
	collapsibleBlock,
	tabsBlock,
	tabBlock,
	columnsBlock,
	columnBlock,
	mermaidBlock,
	chartBlock,
] as const;
