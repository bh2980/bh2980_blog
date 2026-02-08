import { describe, expect, it } from "vitest";
import { __testable__, TOOLBAR_WRAPPER_NODE_NAMES } from "../wrapper-toolbar-host";

const { findActiveToolbarWrapperFromResolvedPos, isWrapperLikeComponentNodeType } = __testable__;

type MockEntry = {
	name: string;
	group?: string;
	content?: string;
	before: number;
};

const createResolvedPos = (entries: MockEntry[]) => ({
	depth: entries.length - 1,
	node: (depth: number) => {
		const entry = entries[depth];
		if (!entry) throw new Error(`No entry at depth ${depth}`);

		return {
			type: {
				name: entry.name,
				spec: {
					group: entry.group,
					content: entry.content,
				},
			},
		};
	},
	before: (depth: number) => {
		const entry = entries[depth];
		if (!entry) throw new Error(`No entry at depth ${depth}`);
		return entry.before;
	},
});

describe("wrapper-toolbar-host helpers", () => {
	it("wrapper-like node 타입 판별을 올바르게 수행한다", () => {
		expect(
			isWrapperLikeComponentNodeType({
				name: "Collapsible",
				spec: { group: "component3", content: "block+" },
			}),
		).toBe(true);

		expect(
			isWrapperLikeComponentNodeType({
				name: "Paragraph",
				spec: { group: "block", content: "inline*" },
			}),
		).toBe(false);
	});

	it("중첩 wrapper에서 가장 안쪽(depth 최대) toolbar 대상 wrapper를 선택한다", () => {
		const $from = createResolvedPos([
			{ name: "doc", content: "block+", before: 0 },
			{ name: "CodeBlock", group: "component1", content: "block+", before: 5 },
			{ name: "paragraph", group: "block", content: "inline*", before: 6 },
			{ name: "Collapsible", group: "component2", content: "block+", before: 10 },
			{ name: "paragraph", group: "block", content: "inline*", before: 11 },
		]);

		const active = findActiveToolbarWrapperFromResolvedPos($from, TOOLBAR_WRAPPER_NODE_NAMES);

		expect(active).toEqual({ depth: 3, pos: 10, nodeName: "Collapsible" });
	});

	it("toolbar 대상이 아닌 wrapper는 건너뛰고 바깥 toolbar 대상 wrapper를 선택한다", () => {
		const $from = createResolvedPos([
			{ name: "doc", content: "block+", before: 0 },
			{ name: "CodeBlock", group: "component1", content: "block+", before: 5 },
			{ name: "UnknownWrapper", group: "component2", content: "block+", before: 9 },
			{ name: "paragraph", group: "block", content: "inline*", before: 10 },
		]);

		const active = findActiveToolbarWrapperFromResolvedPos($from, TOOLBAR_WRAPPER_NODE_NAMES);

		expect(active).toEqual({ depth: 1, pos: 5, nodeName: "CodeBlock" });
	});

	it("노드 이름이 소문자여도 toolbar 대상이면 선택한다", () => {
		const $from = createResolvedPos([
			{ name: "doc", content: "block+", before: 0 },
			{ name: "collapsible", group: "component2", content: "block+", before: 9 },
			{ name: "paragraph", group: "block", content: "inline*", before: 10 },
		]);

		const active = findActiveToolbarWrapperFromResolvedPos($from, TOOLBAR_WRAPPER_NODE_NAMES);

		expect(active).toEqual({ depth: 1, pos: 9, nodeName: "collapsible" });
	});

	it("toolbar 대상 wrapper가 없으면 null을 반환한다", () => {
		const $from = createResolvedPos([
			{ name: "doc", content: "block+", before: 0 },
			{ name: "paragraph", group: "block", content: "inline*", before: 1 },
			{ name: "text", before: 2 },
		]);

		const active = findActiveToolbarWrapperFromResolvedPos($from, TOOLBAR_WRAPPER_NODE_NAMES);
		expect(active).toBeNull();
	});
});
