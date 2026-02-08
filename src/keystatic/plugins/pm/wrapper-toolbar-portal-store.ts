import { useSyncExternalStore } from "react";

export const WRAPPER_TOOLBAR_NODE_ID_ATTR = "data-wrapper-toolbar-node-id";

type WrapperToolbarPortalSnapshot = {
	host: HTMLElement | null;
	activeWrapperId: string | null;
};

type WrapperToolbarPortalStore = {
	getSnapshot(): WrapperToolbarPortalSnapshot;
	subscribe(listener: () => void): () => void;
	setHost(host: HTMLElement | null): void;
	setActiveWrapperId(wrapperId: string | null): void;
};

export const createWrapperToolbarPortalStore = (): WrapperToolbarPortalStore => {
	let snapshot: WrapperToolbarPortalSnapshot = {
		host: null,
		activeWrapperId: null,
	};
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	const setSnapshot = (nextSnapshot: WrapperToolbarPortalSnapshot) => {
		if (snapshot.host === nextSnapshot.host && snapshot.activeWrapperId === nextSnapshot.activeWrapperId) return;
		snapshot = nextSnapshot;
		notify();
	};

	return {
		getSnapshot() {
			return snapshot;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		setHost(host) {
			setSnapshot({
				...snapshot,
				host,
			});
		},
		setActiveWrapperId(activeWrapperId) {
			setSnapshot({
				...snapshot,
				activeWrapperId,
			});
		},
	};
};

export const wrapperToolbarPortalStore = createWrapperToolbarPortalStore();

export const useWrapperToolbarPortalSnapshot = () =>
	useSyncExternalStore(
		wrapperToolbarPortalStore.subscribe,
		wrapperToolbarPortalStore.getSnapshot,
		wrapperToolbarPortalStore.getSnapshot,
	);

export const resolveWrapperToolbarNodeId = (nodeDom: unknown): string | null => {
	if (!(nodeDom instanceof HTMLElement)) return null;
	const root = nodeDom.matches(`[${WRAPPER_TOOLBAR_NODE_ID_ATTR}]`)
		? nodeDom
		: nodeDom.querySelector<HTMLElement>(`[${WRAPPER_TOOLBAR_NODE_ID_ATTR}]`);

	return root?.getAttribute(WRAPPER_TOOLBAR_NODE_ID_ATTR) ?? null;
};
