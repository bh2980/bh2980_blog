import { CUSTOM_BLOCKS } from "@bh2980/cms/blocks/active";
import type { BlockDefinition } from "@bh2980/cms/blocks/define";

/**
 * 사용자 블록(사이트 설정의 `blocks.custom`)의 편집기 표현. `editor.view: "node"`인 사용자 블록은 이름에서 만든
 * Tiptap 노드(`cmsCustom_이름`)로 편집하고, 나머지는 원문 보존 상자로 둔다.
 */

/** 사용자 블록의 Tiptap 노드 이름. */
export const customNodeName = (block: Pick<BlockDefinition, "name">) =>
	`cmsCustom_${block.name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())}`;

/** 편집기 노드로 편집하는 사용자 블록. */
export const CUSTOM_NODE_BLOCKS: readonly BlockDefinition[] = CUSTOM_BLOCKS.filter(
	(block) => block.editor.view === "node",
);

const BY_NODE_NAME = new Map(CUSTOM_NODE_BLOCKS.map((block) => [customNodeName(block), block]));

/** Tiptap 노드 이름 → 사용자 블록 정의. */
export const customBlockOfNode = (nodeName: string): BlockDefinition | undefined => BY_NODE_NAME.get(nodeName);

/** 블록 정의의 기본 속성 값. */
export const defaultValues = (block: BlockDefinition): Record<string, string | boolean> =>
	Object.fromEntries(
		Object.entries(block.attributes).flatMap(([name, attribute]) =>
			attribute.defaultValue === undefined ? [] : [[name, attribute.defaultValue]],
		),
	);

/** 컨테이너 블록인가(본문이나 자식 블록을 담는다). */
export const isContainer = (block: BlockDefinition) => block.syntax.kind === "container";
