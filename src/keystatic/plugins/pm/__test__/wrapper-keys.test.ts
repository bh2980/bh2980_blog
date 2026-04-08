import { Schema } from "prosemirror-model";
import { EditorState, type Plugin, Selection, TextSelection, type Transaction } from "prosemirror-state";
import { describe, expect, it } from "vitest";
import {
	findActiveWrapperDepth,
	getActiveWrapperSelectionRange,
	getSelectedWholeWrapperRange,
	hasPreviousSiblingWithinWrapper,
	isInAnyWrapper,
	isInList,
	isWholeWrapperContentSelected,
	wrapperKeysPlugin,
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

const createPmSchema = () =>
	new Schema({
		nodes: {
			doc: { content: "block+" },
			text: { group: "inline" },
			paragraph: {
				group: "block",
				content: "text*",
				toDOM: () => ["p", 0],
			},
			ordered_list: {
				group: "block",
				content: "list_item+",
				toDOM: () => ["ol", 0],
			},
			unordered_list: {
				group: "block",
				content: "list_item+",
				toDOM: () => ["ul", 0],
			},
			list_item: {
				content: "paragraph block*",
				toDOM: () => ["li", 0],
			},
			Collapsible: {
				group: "component2 block",
				content: "block+",
				toDOM: () => ["div", 0],
			},
		},
	});

const createPmView = (initialState: EditorState) => {
	let state = initialState;

	return {
		get state() {
			return state;
		},
		dispatch(tr: Transaction) {
			state = state.apply(tr);
		},
	};
};

const pressKey = (plugin: Plugin, view: ReturnType<typeof createPmView>, key: string, init?: KeyboardEventInit) => {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	return plugin.props.handleKeyDown?.call(plugin, view as never, event) ?? false;
};

const findTextSelectionRange = (state: EditorState) => {
	const first = Selection.findFrom(state.doc.resolve(1), 1);
	const last = Selection.findFrom(state.doc.resolve(state.doc.content.size), -1);
	if (!first || !last) {
		throw new Error("Could not find selectable text range");
	}

	return {
		from: first.from,
		to: last.to,
	};
};

const findTextCursorPos = (state: EditorState, text: string, offset: number) => {
	let cursorPos: number | null = null;

	state.doc.descendants((node, pos) => {
		if (!node.isText) return;
		if (node.text !== text) return;
		cursorPos = pos + offset;
	});

	if (cursorPos == null) {
		throw new Error(`Could not find text node: ${text}`);
	}

	return cursorPos;
};

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

	it("wrapper 내부 전체 선택 후 Delete를 누르면 단일 문단 wrapper는 빈 문단 하나만 남긴다", () => {
		const schema = createPmSchema();
		const plugin = wrapperKeysPlugin(schema);
		const doc = schema.node("doc", null, [
			schema.node("Collapsible", null, [schema.node("paragraph", null, [schema.text("abc")])]),
		]);
		const selectedRange = findTextSelectionRange(
			EditorState.create({
				schema,
				doc,
			}),
		);
		const view = createPmView(
			EditorState.create({
				schema,
				doc,
				selection: TextSelection.create(doc, selectedRange.from, selectedRange.to),
				plugins: [plugin],
			}),
		);

		expect(pressKey(plugin, view, "Delete")).toBe(true);
		expect(view.state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "Collapsible",
					content: [{ type: "paragraph" }],
				},
			],
		});
	});

	it("wrapper 내부 전체 선택 후 Delete를 누르면 리스트만 있던 wrapper도 빈 기본 문단으로 초기화한다", () => {
		const schema = createPmSchema();
		const plugin = wrapperKeysPlugin(schema);
		const doc = schema.node("doc", null, [
			schema.node("Collapsible", null, [
				schema.node("ordered_list", null, [
					schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("abc")])]),
				]),
			]),
		]);
		const selectedRange = findTextSelectionRange(
			EditorState.create({
				schema,
				doc,
			}),
		);
		const view = createPmView(
			EditorState.create({
				schema,
				doc,
				selection: TextSelection.create(doc, selectedRange.from, selectedRange.to),
				plugins: [plugin],
			}),
		);

		expect(pressKey(plugin, view, "Delete")).toBe(true);
		expect(view.state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "Collapsible",
					content: [{ type: "paragraph" }],
				},
			],
		});
	});

	it("부분 선택 삭제는 wrapper를 유지한 채 선택된 내용만 지운다", () => {
		const schema = createPmSchema();
		const plugin = wrapperKeysPlugin(schema);
		const doc = schema.node("doc", null, [
			schema.node("Collapsible", null, [schema.node("paragraph", null, [schema.text("abc")])]),
		]);
		const view = createPmView(
			EditorState.create({
				schema,
				doc,
				selection: TextSelection.create(doc, 2, 3),
				plugins: [plugin],
			}),
		);

		expect(pressKey(plugin, view, "Delete")).toBe(true);
		expect(view.state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "Collapsible",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: "bc" }],
						},
					],
				},
				],
			});
		});

	it("리스트 안에서 lift가 불가능해도 Backspace는 wrapper 내부 삭제 처리로 이어진다", () => {
		const schema = createPmSchema();
		const plugin = wrapperKeysPlugin(schema);
		const doc = schema.node("doc", null, [
			schema.node("Collapsible", null, [
				schema.node("ordered_list", null, [
					schema.node("list_item", null, [schema.node("paragraph", null, [schema.text("abc")])]),
				]),
			]),
		]);
		const initialState = EditorState.create({
			schema,
			doc,
			plugins: [plugin],
		});
		const cursorPos = findTextCursorPos(initialState, "abc", 2);
		const view = createPmView(
			EditorState.create({
				schema,
				doc,
				selection: TextSelection.create(doc, cursorPos),
				plugins: [plugin],
			}),
		);

		expect(pressKey(plugin, view, "Backspace")).toBe(true);
		expect(view.state.doc.toJSON()).toEqual({
			type: "doc",
			content: [
				{
					type: "Collapsible",
					content: [
						{
							type: "ordered_list",
							content: [
								{
									type: "list_item",
									content: [
										{
											type: "paragraph",
											content: [{ type: "text", text: "ac" }],
										},
									],
								},
							],
						},
					],
				},
			],
		});
	});
});
