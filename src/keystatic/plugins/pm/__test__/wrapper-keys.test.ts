import { describe, expect, it } from "vitest";
import {
	findActiveWrapperDepth,
	getActiveWrapperSelectionRange,
	getSelectedWholeWrapperRange,
	hasPreviousSiblingWithinWrapper,
	isInAnyWrapper,
	isInList,
	isWholeWrapperContentSelected,
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
				before: (depth: number) => depth,
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
					before: (depth: number) => depth,
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
					before: (depth: number) => depth,
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
					before: (depth: number) => depth,
				},
			},
		} as never;

		expect(hasPreviousSiblingWithinWrapper(stateAfterList)).toBe(true);
	});

	it("wrapper 내부 전체 선택일 때만 내용 삭제 보호가 걸린다", () => {
		const $from = {
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
			start: () => 12,
			end: () => 42,
			before: (depth: number) => depth,
		};

		const state = {
			selection: {
				from: 13,
				to: 41,
				empty: false,
				$from,
				$to: $from,
			},
		} as never;

		expect(isWholeWrapperContentSelected(state)).toBe(true);

		const partialState = {
			selection: {
				from: 15,
				to: 20,
				empty: false,
				$from,
				$to: $from,
			},
		} as never;

		expect(isWholeWrapperContentSelected(partialState)).toBe(false);
	});

	it("선택 끝점이 바깥 wrapper로 해석돼도 활성 wrapper 전체 선택 범위는 유지한다", () => {
		const $from = {
			depth: 5,
			node: (depth: number) => {
				const entries = [
					{ name: "doc", content: "block+" },
					{ name: "OuterCollapsible", group: "component2", content: "block+" },
					{ name: "Collapsible", group: "component2", content: "block+" },
					{ name: "Tabs", group: "component2", content: "block+" },
					{ name: "paragraph", group: "block", content: "inline*" },
					{ name: "text", group: "inline" },
				];
				const entry = entries[depth];
				if (!entry) throw new Error(`No entry at depth ${depth}`);
				return { type: { name: entry.name, spec: { group: entry.group, content: entry.content } } };
			},
			start: (depth: number) => {
				if (depth === 2) return 20;
				if (depth === 3) return 21;
				return 28;
			},
			end: (depth: number) => {
				if (depth === 2) return 60;
				if (depth === 3) return 40;
				return 36;
			},
			before: (depth: number) => depth,
		};

		const $to = {
			depth: 5,
			node: (depth: number) => {
				const entries = [
					{ name: "doc", content: "block+" },
					{ name: "OuterCollapsible", group: "component2", content: "block+" },
					{ name: "Collapsible", group: "component2", content: "block+" },
					{ name: "ordered_list", group: "block", content: "list_item+" },
					{ name: "list_item", content: "paragraph block*" },
					{ name: "paragraph", group: "block", content: "inline*" },
				];
				const entry = entries[depth];
				if (!entry) throw new Error(`No entry at depth ${depth}`);
				return { type: { name: entry.name, spec: { group: entry.group, content: entry.content } } };
			},
			start: (depth: number) => (depth === 2 ? 20 : 44),
			end: (depth: number) => (depth === 2 ? 60 : 56),
			before: (depth: number) => depth,
		};

		const state = {
			selection: {
				from: 21,
				to: 59,
				empty: false,
				$from,
				$to,
			},
		} as never;

		expect(isWholeWrapperContentSelected(state)).toBe(true);
		expect(getSelectedWholeWrapperRange(state)).toEqual({ from: 21, to: 59 });
	});
});
