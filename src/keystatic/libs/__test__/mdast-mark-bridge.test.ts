import type { Paragraph, Root, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { describe, expect, it } from "vitest";
import {
	convertBodyMdastMarksToMdxJsxTextElement,
	convertBodyMdxJsxTextElementToMdastMarks,
} from "../mdast-mark-bridge";

const text = (value: string): Text => ({ type: "text", value });

const paragraph = (children: Paragraph["children"]): Paragraph => ({
	type: "paragraph",
	children,
});

const mdxText = (
	name: string,
	children: MdxJsxTextElement["children"],
	attributes: MdxJsxAttribute[] = [],
): MdxJsxTextElement => ({
	type: "mdxJsxTextElement",
	name,
	attributes,
	children,
});

const codeBlock = (children: MdxJsxFlowElement["children"]): MdxJsxFlowElement => ({
	type: "mdxJsxFlowElement",
	name: "CodeBlock",
	attributes: [{ type: "mdxJsxAttribute", name: "lang", value: "ts" }],
	children,
});

describe("mdast mark bridge", () => {
	it("본문 strong/delete/emphasis를 mdxJsxTextElement(strong/del/em)로 변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				paragraph([
					{ type: "strong", children: [text("bold")] },
					text(" "),
					{ type: "delete", children: [text("strike")] },
					text(" "),
					{ type: "emphasis", children: [text("italic")] },
				]),
				codeBlock([paragraph([{ type: "strong", children: [text("inside")] }])]),
			],
		};

		convertBodyMdastMarksToMdxJsxTextElement(input);

		const bodyParagraph = input.children[0];
		if (!bodyParagraph || bodyParagraph.type !== "paragraph") {
			throw new Error("Expected first child to be paragraph");
		}

		expect(bodyParagraph.children[0]).toMatchObject({ type: "mdxJsxTextElement", name: "strong" });
		expect(bodyParagraph.children[2]).toMatchObject({ type: "mdxJsxTextElement", name: "del" });
		expect(bodyParagraph.children[4]).toMatchObject({ type: "mdxJsxTextElement", name: "em" });

		const block = input.children[1];
		if (!block || block.type !== "mdxJsxFlowElement" || block.name !== "CodeBlock") {
			throw new Error("Expected second child to be CodeBlock");
		}

		const line = block.children[0];
		if (!line || line.type !== "paragraph") {
			throw new Error("Expected CodeBlock first child to be paragraph");
		}
		expect(line.children[0]).toMatchObject({ type: "strong" });
	});

	it("본문 mdxJsxTextElement(strong/del/em)를 strong/delete/emphasis로 역변환한다", () => {
		const input: Root = {
			type: "root",
			children: [
				paragraph([
					mdxText("strong", [text("bold")]),
					text(" "),
					mdxText("del", [text("strike")]),
					text(" "),
					mdxText("em", [text("italic")]),
					text(" "),
					mdxText("strong", [text("keep-attr")], [{ type: "mdxJsxAttribute", name: "data-x", value: "1" }]),
				]),
				codeBlock([paragraph([mdxText("strong", [text("inside")])])]),
			],
		};

		convertBodyMdxJsxTextElementToMdastMarks(input);

		const bodyParagraph = input.children[0];
		if (!bodyParagraph || bodyParagraph.type !== "paragraph") {
			throw new Error("Expected first child to be paragraph");
		}

		expect(bodyParagraph.children[0]).toMatchObject({ type: "strong" });
		expect(bodyParagraph.children[2]).toMatchObject({ type: "delete" });
		expect(bodyParagraph.children[4]).toMatchObject({ type: "emphasis" });
		expect(bodyParagraph.children[6]).toMatchObject({ type: "mdxJsxTextElement", name: "strong" });

		const block = input.children[1];
		if (!block || block.type !== "mdxJsxFlowElement" || block.name !== "CodeBlock") {
			throw new Error("Expected second child to be CodeBlock");
		}

		const line = block.children[0];
		if (!line || line.type !== "paragraph") {
			throw new Error("Expected CodeBlock first child to be paragraph");
		}
		expect(line.children[0]).toMatchObject({ type: "mdxJsxTextElement", name: "strong" });
	});
});
