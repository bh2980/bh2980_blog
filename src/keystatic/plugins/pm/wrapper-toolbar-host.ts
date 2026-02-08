import { Plugin } from "prosemirror-state";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";

type WrapperNodeTypeLike = {
	name: string;
	spec: {
		group?: string;
		content?: string;
	};
};

type ToolbarResolvedPos = {
	depth: number;
	node(depth: number): { type: WrapperNodeTypeLike };
	before(depth: number): number;
};

type ActiveToolbarWrapper = {
	pos: number;
	depth: number;
	nodeName: string;
};

const TOOLBAR_ACTIVE_ATTR = "data-wrapper-toolbar-active";
const TOOLBAR_NODE_ATTR = "data-wrapper-toolbar-node";

export const TOOLBAR_WRAPPER_NODE_NAMES = new Set<string>([
	EDITOR_CODE_BLOCK_NAME,
	"Collapsible",
	"Callout",
	"collapsible",
	"callout",
]);

export const isWrapperLikeComponentNodeType = (type: WrapperNodeTypeLike) => {
	const groupStr = type.spec.group ?? "";
	const isKeystaticComponent = groupStr.split(/\s+/).some((group) => group.startsWith("component"));
	const contentSpec = type.spec.content;
	const isWrapperLike = typeof contentSpec === "string" && contentSpec.includes("block+");
	return isKeystaticComponent && isWrapperLike;
};

export const findActiveToolbarWrapperFromResolvedPos = (
	$from: ToolbarResolvedPos,
	nodeNames: Set<string>,
): ActiveToolbarWrapper | null => {
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const nodeType = $from.node(depth).type;
		if (!isWrapperLikeComponentNodeType(nodeType)) continue;
		if (!nodeNames.has(nodeType.name)) continue;

		return {
			pos: $from.before(depth),
			depth,
			nodeName: nodeType.name,
		};
	}

	return null;
};

const setToolbarActive = (nodeDom: unknown, active: boolean) => {
	if (!(nodeDom instanceof HTMLElement)) return;
	const wrapperRoot =
		nodeDom.matches(`[${TOOLBAR_NODE_ATTR}]`) ? nodeDom : nodeDom.querySelector<HTMLElement>(`[${TOOLBAR_NODE_ATTR}]`);

	if (!wrapperRoot) return;

	if (active) {
		wrapperRoot.setAttribute(TOOLBAR_ACTIVE_ATTR, "true");
		return;
	}
	wrapperRoot.removeAttribute(TOOLBAR_ACTIVE_ATTR);
};

export const wrapperToolbarHostPlugin = (nodeNames = TOOLBAR_WRAPPER_NODE_NAMES) =>
	new Plugin({
		view(view) {
			let editorView = view;
			let activePos: number | null = null;

			const syncActiveWrapper = () => {
				const activeWrapper = findActiveToolbarWrapperFromResolvedPos(editorView.state.selection.$from, nodeNames);
				const nextPos = activeWrapper?.pos ?? null;

				if (activePos != null && activePos !== nextPos) {
					setToolbarActive(editorView.nodeDOM(activePos), false);
				}

				if (nextPos == null) {
					activePos = null;
					return;
				}

				setToolbarActive(editorView.nodeDOM(nextPos), true);
				activePos = nextPos;
			};

			syncActiveWrapper();

			return {
				update(nextView) {
					editorView = nextView;
					syncActiveWrapper();
				},
				destroy() {
					if (activePos == null) return;
					setToolbarActive(editorView.nodeDOM(activePos), false);
				},
			};
		},
	});

export const __testable__ = {
	isWrapperLikeComponentNodeType,
	findActiveToolbarWrapperFromResolvedPos,
};
