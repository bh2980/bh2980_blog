/**
 * 블록 확장(`@bh2980/cms-blocks`). 필요한 블록만 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * import { callout, tabs, mermaid } from "@bh2980/cms-blocks";
 * plugins: [callout(), tabs(), mermaid()]
 * ```
 */
export { callout, calloutBlock } from "./callout";
export { chart, chartBlock } from "./chart";
export { collapsible, collapsibleBlock } from "./collapsible";
export { columnBlock, columns, columnsBlock } from "./columns";
export { ALL_BLOCKS } from "./definitions";
export { mermaid, mermaidBlock } from "./mermaid";
export { tabBlock, tabs, tabsBlock } from "./tabs";
