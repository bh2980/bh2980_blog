import type { BlockDefinition } from "@bh2980/cms/client";
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CUSTOM_NODE_BLOCKS, customNodeName, isContainer } from "./shared";
import { CustomBlockNodeView } from "./view";

const parseJson = (value: string | null, fallback: unknown) => {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
};

/** 사용자 블록의 Tiptap 노드. 컨테이너는 본문(또는 정해진 자식 블록)을 담고, 한 줄 블록은 통째로 고르는 노드다. */
export function createCustomBlockNode(block: BlockDefinition, all: readonly BlockDefinition[]): Node {
	const name = customNodeName(block);
	const children = (block.children?.blocks ?? []).flatMap((child) => {
		const definition = all.find((candidate) => candidate.name === child);
		return definition ? [customNodeName(definition)] : [];
	});
	const content = !isContainer(block) ? undefined : children.length > 0 ? `(${children.join(" | ")})+` : "block+";
	return Node.create({
		name,
		// 부모 전용 블록은 부모 안에만 둔다.
		...(block.parent ? {} : { group: "block" }),
		...(content ? { content, isolating: true } : { atom: true }),
		selectable: true,
		draggable: false,
		addAttributes() {
			return {
				values: {
					default: {},
					parseHTML: (element) => parseJson(element.getAttribute("data-cms-values"), {}),
					renderHTML: (attributes) => ({ "data-cms-values": JSON.stringify(attributes.values ?? {}) }),
				},
				originalAttributes: {
					default: [],
					parseHTML: (element) => parseJson(element.getAttribute("data-cms-original-attributes"), []),
					renderHTML: (attributes) => ({
						"data-cms-original-attributes": JSON.stringify(attributes.originalAttributes ?? []),
					}),
				},
			};
		},
		parseHTML() {
			return [{ tag: `div[data-cms-block="${block.name}"]` }];
		},
		renderHTML({ HTMLAttributes }) {
			return content
				? ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name }), 0]
				: ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name })];
		},
		addNodeView() {
			return ReactNodeViewRenderer(CustomBlockNodeView);
		},
	});
}

/** 사이트 설정의 사용자 블록 노드 전부. */
export const CUSTOM_BLOCK_NODES: readonly Node[] = CUSTOM_NODE_BLOCKS.map((block) =>
	createCustomBlockNode(block, CUSTOM_NODE_BLOCKS),
);
