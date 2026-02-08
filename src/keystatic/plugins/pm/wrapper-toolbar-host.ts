import { Plugin } from "prosemirror-state";
import { EDITOR_CODE_BLOCK_NAME } from "@/keystatic/fields/mdx/components/code-block";
import {
	WRAPPER_TOOLBAR_NODE_ID_ATTR,
	resolveWrapperToolbarNodeId,
	wrapperToolbarPortalStore,
} from "./wrapper-toolbar-portal-store";

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
const TOOLBAR_HOST_ATTR = "data-wrapper-toolbar-host";

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

const resolveWrapperToolbarRoot = (nodeDom: unknown) => {
	if (!(nodeDom instanceof HTMLElement)) return null;
	return nodeDom.matches(`[${WRAPPER_TOOLBAR_NODE_ID_ATTR}]`)
		? nodeDom
		: nodeDom.querySelector<HTMLElement>(`[${WRAPPER_TOOLBAR_NODE_ID_ATTR}]`);
};

export const wrapperToolbarHostPlugin = (nodeNames = TOOLBAR_WRAPPER_NODE_NAMES) =>
	new Plugin({
		view(view) {
			let editorView = view;
			const host = document.createElement("div");
			host.setAttribute(TOOLBAR_HOST_ATTR, "true");
			document.body.append(host);
			wrapperToolbarPortalStore.setHost(host);

			const syncHostPosition = (nodeDom: unknown) => {
				const wrapperRoot = resolveWrapperToolbarRoot(nodeDom);
				if (!wrapperRoot) {
					host.style.display = "none";
					return null;
				}

				const rect = wrapperRoot.getBoundingClientRect();
				host.style.display = "block";
				host.style.left = `${rect.left + rect.width / 2}px`;
				host.style.top = `${rect.bottom + 8}px`;
				return wrapperRoot;
			};

			const syncActiveWrapper = () => {
				const activeWrapper = findActiveToolbarWrapperFromResolvedPos(editorView.state.selection.$from, nodeNames);
				if (!activeWrapper) {
					host.style.display = "none";
					wrapperToolbarPortalStore.setActiveWrapperId(null);
					return;
				}

				const nodeDom = editorView.nodeDOM(activeWrapper.pos);
				syncHostPosition(nodeDom);
				const wrapperId = resolveWrapperToolbarNodeId(nodeDom);
				wrapperToolbarPortalStore.setActiveWrapperId(wrapperId);
			};
			const syncOnViewportChange = () => {
				const activeWrapper = findActiveToolbarWrapperFromResolvedPos(editorView.state.selection.$from, nodeNames);
				if (!activeWrapper) return;
				const nodeDom = editorView.nodeDOM(activeWrapper.pos);
				syncHostPosition(nodeDom);
			};

			syncActiveWrapper();
			window.addEventListener("scroll", syncOnViewportChange, true);
			window.addEventListener("resize", syncOnViewportChange);

			return {
				update(nextView) {
					editorView = nextView;
					syncActiveWrapper();
				},
				destroy() {
					window.removeEventListener("scroll", syncOnViewportChange, true);
					window.removeEventListener("resize", syncOnViewportChange);
					wrapperToolbarPortalStore.setActiveWrapperId(null);
					wrapperToolbarPortalStore.setHost(null);
					host.remove();
				},
			};
		},
	});

export const __testable__ = {
	isWrapperLikeComponentNodeType,
	findActiveToolbarWrapperFromResolvedPos,
};
