import { Fragment, type Node as PMNode, Schema, Slice } from "prosemirror-model";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { describe, expect, it } from "vitest";
import {
	markSliceAsUnwrapped,
	shouldUnwrapCopiedSelection,
	unwrapOpenWrapperSlice,
	wasSliceUnwrapped,
} from "../wrapper-copy";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { group: "block", content: "text*" },
		wrapper: { group: "block component0", content: "block+" },
		blockquote: { group: "block", content: "block+" },
		text: { group: "inline" },
	},
});

const textNode = (value: string) => schema.text(value);
const paragraph = (value: string) => schema.nodes.paragraph.create(null, [textNode(value)]);
const createWrapper = (...children: PMNode[]) => schema.nodes.wrapper.create(null, children);
const createBlockquote = (...children: PMNode[]) => schema.nodes.blockquote.create(null, children);
const docWithWrapper = schema.node("doc", null, [createWrapper(paragraph("hello"))]);

describe("unwrapOpenWrapperSlice", () => {
	it("부분 선택으로 열린 바깥 wrapper는 벗긴다", () => {
		const wrappedParagraph = createWrapper(paragraph("hello"));
		const slice = new Slice(Fragment.from(wrappedParagraph), 1, 1);

		const result = unwrapOpenWrapperSlice(slice);

		expect(result.changed).toBe(true);
		expect(result.slice.openStart).toBe(0);
		expect(result.slice.openEnd).toBe(0);
		expect(result.slice.content.firstChild?.type.name).toBe("paragraph");
	});

	it("wrapper 전체를 고른 경우는 그대로 둔다", () => {
		const wrappedParagraph = createWrapper(paragraph("hello"));
		const slice = new Slice(Fragment.from(wrappedParagraph), 0, 0);

		const result = unwrapOpenWrapperSlice(slice);

		expect(result.changed).toBe(false);
		expect(result.slice).toBe(slice);
	});

	it("일반 block+ 노드는 wrapper가 아니면 유지한다", () => {
		const quotedParagraph = createBlockquote(paragraph("hello"));
		const slice = new Slice(Fragment.from(quotedParagraph), 1, 1);

		const result = unwrapOpenWrapperSlice(slice);

		expect(result.changed).toBe(false);
		expect(result.slice).toBe(slice);
	});

	it("unwrapped slice에는 복사 플래그를 태그할 수 있다", () => {
		const slice = new Slice(Fragment.from(paragraph("hello")), 0, 0);
		const tagged = markSliceAsUnwrapped(slice);

		expect(wasSliceUnwrapped(tagged)).toBe(true);
	});

	it("텍스트 선택일 때만 wrapper 벗기기를 허용한다", () => {
		const selection = TextSelection.create(docWithWrapper, 3, 6);

		expect(shouldUnwrapCopiedSelection(selection)).toBe(true);
	});

	it("블록 자체 선택은 구조 복사를 유지한다", () => {
		const selection = NodeSelection.create(docWithWrapper, 0);

		expect(shouldUnwrapCopiedSelection(selection)).toBe(false);
	});
});
