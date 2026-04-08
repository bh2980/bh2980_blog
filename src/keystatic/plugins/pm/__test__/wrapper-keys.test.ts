import { describe, expect, it } from "vitest";
import {
	findActiveWrapperDepth,
	getActiveWrapperSelectionRange,
	hasPreviousSiblingWithinWrapper,
	isInAnyWrapper,
	isInList,
} from "../wrapper-keys";

type MockEntry = {
	name: string;
	group?: string;
	content?: string;
};

const createState = (entries: MockEntry[]) =>
	({
		selection: {
			$from: {
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
				index: () => 0,
			},
		},
	}) as never;

describe("wrapper-keys helpers", () => {
	it("wrapper 내부의 리스트 컨텍스트를 감지한다", () => {
		const state = createState([
			{ name: "doc", content: "block+" },
			{ name: "Collapsible", group: "component2", content: "block+" },
			{ name: "ordered_list", group: "block", content: "list_item+" },
			{ name: "list_item", content: "paragraph block*" },
			{ name: "paragraph", group: "block", content: "inline*" },
		]);

		expect(isInAnyWrapper(state)).toBe(true);
		expect(findActiveWrapperDepth(state)).toBe(1);
		expect(isInList(state)).toBe(true);
	});

	it("unordered_list도 리스트 컨텍스트로 감지한다", () => {
		const state = createState([
			{ name: "doc", content: "block+" },
			{ name: "Callout", group: "component2", content: "block+" },
			{ name: "unordered_list", group: "block", content: "list_item+" },
			{ name: "list_item", content: "paragraph block*" },
			{ name: "paragraph", group: "block", content: "inline*" },
		]);

		expect(isInAnyWrapper(state)).toBe(true);
		expect(findActiveWrapperDepth(state)).toBe(1);
		expect(isInList(state)).toBe(true);
	});

	it("리스트가 아닌 일반 wrapper 문단은 기존대로 wrapper 컨텍스트만 감지한다", () => {
		const state = createState([
			{ name: "doc", content: "block+" },
			{ name: "Callout", group: "component2", content: "block+" },
			{ name: "paragraph", group: "block", content: "inline*" },
		]);

		expect(isInAnyWrapper(state)).toBe(true);
		expect(findActiveWrapperDepth(state)).toBe(1);
		expect(isInList(state)).toBe(false);
	});

	it("Mod-a 범위 계산은 일반 wrapper 내부만 잡는다", () => {
		const state = {
			selection: {
				$from: {
					depth: 2,
					node: (depth: number) => {
						const entries = [
							{ name: "doc", content: "block+" },
							{ name: "Callout", group: "component2", content: "block+" },
							{ name: "paragraph", group: "block", content: "inline*" },
						];
						const entry = entries[depth];
						if (!entry) throw new Error(`No entry at depth ${depth}`);
						return { type: { name: entry.name, spec: { group: entry.group, content: entry.content } } };
					},
					start: () => 8,
					end: () => 20,
				},
			},
		} as never;

		expect(getActiveWrapperSelectionRange(state)).toEqual({ from: 9, to: 19 });
	});

	it("Mod-a 범위 계산은 리스트 안에서도 wrapper 바깥으로 새지 않는다", () => {
		const state = {
			selection: {
				$from: {
					depth: 4,
					node: (depth: number) => {
						const entries = [
							{ name: "doc", content: "block+" },
							{ name: "Collapsible", group: "component2", content: "block+" },
							{ name: "ordered_list", group: "block", content: "list_item+" },
							{ name: "list_item", content: "paragraph block*" },
							{ name: "paragraph", group: "block", content: "inline*" },
						];
						const entry = entries[depth];
						if (!entry) throw new Error(`No entry at depth ${depth}`);
						return { type: { name: entry.name, spec: { group: entry.group, content: entry.content } } };
					},
					start: (depth: number) => (depth === 1 ? 12 : 18),
					end: (depth: number) => (depth === 1 ? 42 : 26),
				},
			},
		} as never;

		expect(getActiveWrapperSelectionRange(state)).toEqual({ from: 13, to: 41 });
	});

	it("wrapper 안에서 앞선 형제가 있으면 기본 Backspace로 넘길 수 있다", () => {
		const state = createState([
			{ name: "doc", content: "block+" },
			{ name: "Collapsible", group: "component2", content: "block+" },
			{ name: "ordered_list", group: "block", content: "list_item+" },
			{ name: "list_item", content: "paragraph block*" },
			{ name: "paragraph", group: "block", content: "inline*" },
		]);

		expect(hasPreviousSiblingWithinWrapper(state)).toBe(false);

		const stateAfterList = {
			selection: {
				$from: {
					depth: 2,
					node: (depth: number) => {
						const entries = [
							{ name: "doc", content: "block+" },
							{ name: "Collapsible", group: "component2", content: "block+" },
							{ name: "paragraph", group: "block", content: "inline*" },
						];
						const entry = entries[depth];
						if (!entry) throw new Error(`No entry at depth ${depth}`);
						return { type: { name: entry.name, spec: { group: entry.group, content: entry.content } } };
					},
					index: (depth: number) => (depth === 1 ? 1 : 0),
				},
			},
		} as never;

		expect(hasPreviousSiblingWithinWrapper(stateAfterList)).toBe(true);
	});
});
