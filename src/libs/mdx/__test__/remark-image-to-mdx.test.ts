import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { remarkImageToMdx } from "../remark-image-to-mdx";

describe("remarkImageToMdx", () => {
	it("markdown image를 mdx img 요소로 변환한다", async () => {
		const source = "![alt text](/assets/images/posts/example.png)";
		const processor = unified().use(remarkParse).use(remarkMdx).use(remarkImageToMdx);
		const tree = processor.parse(source) as Root;

		await processor.run(tree);

		const paragraph = tree.children[0];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (!paragraph || paragraph.type !== "paragraph") {
			throw new Error("Expected first node to be a paragraph");
		}

		expect(paragraph.children).toMatchObject([
			{
				type: "mdxJsxTextElement",
				name: "img",
				attributes: [
					{ type: "mdxJsxAttribute", name: "src", value: "/assets/images/posts/example.png" },
					{ type: "mdxJsxAttribute", name: "alt", value: "alt text" },
				],
			},
		]);
	});
});
