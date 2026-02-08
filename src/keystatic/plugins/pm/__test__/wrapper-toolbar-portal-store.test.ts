import { describe, expect, it, vi } from "vitest";
import {
	WRAPPER_TOOLBAR_NODE_ID_ATTR,
	createWrapperToolbarPortalStore,
	resolveWrapperToolbarNodeId,
} from "../wrapper-toolbar-portal-store";

describe("wrapper-toolbar-portal-store", () => {
	it("초기 상태는 host/activeWrapperId가 null이다", () => {
		const store = createWrapperToolbarPortalStore();
		expect(store.getSnapshot()).toEqual({
			host: null,
			activeWrapperId: null,
		});
	});

	it("host/activeWrapperId 변경 시 subscriber를 호출한다", () => {
		const store = createWrapperToolbarPortalStore();
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		const host = document.createElement("div");
		store.setHost(host);
		store.setActiveWrapperId("wrapper-1");

		expect(listener).toHaveBeenCalledTimes(2);
		expect(store.getSnapshot()).toEqual({
			host,
			activeWrapperId: "wrapper-1",
		});

		unsubscribe();
		store.setActiveWrapperId("wrapper-2");
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("동일 값 재설정 시 불필요한 notify를 하지 않는다", () => {
		const store = createWrapperToolbarPortalStore();
		const listener = vi.fn();
		store.subscribe(listener);

		const host = document.createElement("div");
		store.setHost(host);
		store.setHost(host);
		store.setActiveWrapperId("wrapper-1");
		store.setActiveWrapperId("wrapper-1");

		expect(listener).toHaveBeenCalledTimes(2);
	});
});

describe("resolveWrapperToolbarNodeId", () => {
	it("현재 node가 wrapper root면 해당 id를 반환한다", () => {
		const root = document.createElement("div");
		root.setAttribute(WRAPPER_TOOLBAR_NODE_ID_ATTR, "wrapper-root");

		expect(resolveWrapperToolbarNodeId(root)).toBe("wrapper-root");
	});

	it("현재 node 하위에 wrapper root가 있으면 해당 id를 반환한다", () => {
		const container = document.createElement("div");
		const root = document.createElement("div");
		root.setAttribute(WRAPPER_TOOLBAR_NODE_ID_ATTR, "wrapper-child");
		container.append(root);

		expect(resolveWrapperToolbarNodeId(container)).toBe("wrapper-child");
	});

	it("wrapper root를 찾지 못하면 null을 반환한다", () => {
		const node = document.createElement("div");
		expect(resolveWrapperToolbarNodeId(node)).toBeNull();
	});
});

