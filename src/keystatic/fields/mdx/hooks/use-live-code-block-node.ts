import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import { useSyncExternalStore } from "react";
import { getCodeBlockMapSnapshot, subscribeCodeBlockMap } from "../runtime/find-codeblock-and-mapping";

export function useLiveCodeBlockNode(id?: string) {
	return useSyncExternalStore(
		subscribeCodeBlockMap,
		() => {
			if (!id) return undefined;
			return getCodeBlockMapSnapshot().get(id);
		},
		() => undefined,
	) as MdxJsxFlowElement | undefined;
}
