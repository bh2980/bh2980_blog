import type { Root } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { EDITOR_CODE_BLOCK_NAME } from "../fields/mdx/components/code-block";
import { EDITOR_MERMAID_NAME } from "../fields/mdx/components/mermaid";

type Snapshot = ReadonlyMap<string, MdxJsxFlowElement>;

let snapshot: Snapshot = new Map();
const listeners = new Set<() => void>();

export const subscribeCodeBlockMap = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const getCodeBlockMapSnapshot = () => snapshot;

// ✅ 동기 emit 금지 → 마이크로태스크로 미루고 coalesce
// TODO 공부해보기
/**
 * ## Error Message
Cannot update a component (CodeBlockNodeView) while rendering a different component (LocalItemPage). 
To locate the bad setState() call inside LocalItemPage, follow the stack trace as described in https://react.dev/link/setstate-in-render

at emit (src/keystatic/libs/find-codeblock-and-mapping.ts:19:29)
 */
let queued = false;
const schedule = typeof queueMicrotask === "function" ? queueMicrotask : (cb: () => void) => Promise.resolve().then(cb);

const emitAsync = () => {
	if (queued) return;
	queued = true;
	schedule(() => {
		queued = false;
		for (const l of listeners) l();
	});
};

export const findCodeBlockAndMapping = (root: Root) => {
	const next = new Map<string, MdxJsxFlowElement>();

	visit(root, "mdxJsxFlowElement", (node) => {
		if (node.name !== EDITOR_CODE_BLOCK_NAME && node.name !== EDITOR_MERMAID_NAME) return;

		const idAttr = node.attributes.find((attr): attr is any => attr.type === "mdxJsxAttribute" && attr.name === "id");

		const id = idAttr?.value;
		if (typeof id !== "string" || !id) return;

		next.set(id, node);
	});

	snapshot = next;
	emitAsync(); // ✅ 여기서 즉시 리스너 호출하지 않음
};
