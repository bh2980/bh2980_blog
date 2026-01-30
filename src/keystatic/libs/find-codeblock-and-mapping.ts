import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME } from "../fields/mdx/components/code-block";

type Snapshot = ReadonlyMap<string, MdxJsxFlowElement>;

let snapshot: Snapshot = new Map();
const listeners = new Set<() => void>();

export const subscribeCodeBlockMap = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const getCodeBlockMapSnapshot = () => snapshot;

const emit = () => {
	for (const l of listeners) l();
};

export const findCodeBlockAndMapping = (root: Root) => {
	const next = new Map<string, MdxJsxFlowElement>();

	visit(root, "mdxJsxFlowElement", (node) => {
		if (node.name !== EDITOR_CODE_BLOCK_NAME) return;

		const idAttr = node.attributes.find((attr): attr is any => attr.type === "mdxJsxAttribute" && attr.name === "id");

		const id = idAttr?.value;
		if (typeof id !== "string" || !id) return;

		next.set(id, node);
	});

	snapshot = next;
	emit();
};
