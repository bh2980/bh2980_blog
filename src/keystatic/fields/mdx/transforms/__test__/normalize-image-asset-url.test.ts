import type { Root } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__, normalizeImageAssetUrls } from "../normalize-image-asset-url";

const nfdFilename = "스크린샷 2026-02-12 오후 7.41.00.png";
const toAssetPath = (filename: string) => `/assets/images/posts/${encodeURIComponent(filename)}`;

describe("normalize image asset url", () => {
	it("assets/images 경로의 NFD 인코딩을 NFC 인코딩으로 정규화한다", () => {
		const input = toAssetPath(nfdFilename);
		const output = __testable__.normalizeAssetPath(input);

		expect(output).toBe(toAssetPath(nfdFilename.normalize("NFC")));
	});

	it("query/hash를 유지하면서 정규화한다", () => {
		const input = `${toAssetPath(nfdFilename)}?w=1200#hero`;
		const output = __testable__.normalizeAssetPath(input);

		expect(output).toBe(`${toAssetPath(nfdFilename.normalize("NFC"))}?w=1200#hero`);
	});

	it("assets/images 외 경로는 변경하지 않는다", () => {
		const input = `/contents/posts/${encodeURIComponent(nfdFilename)}`;
		const output = __testable__.normalizeAssetPath(input);

		expect(output).toBe(input);
	});

	it("memos 경로도 동일하게 정규화한다", () => {
		const input = `/assets/images/memos/${encodeURIComponent(nfdFilename)}`;
		const output = __testable__.normalizeAssetPath(input);

		expect(output).toBe(`/assets/images/memos/${encodeURIComponent(nfdFilename.normalize("NFC"))}`);
	});

	it("mdast image와 mdx jsx src/href attribute를 함께 정규화한다", () => {
		const imageUrl = toAssetPath(nfdFilename);
		const input: Root = {
			type: "root",
			children: [
				{ type: "image", url: imageUrl, alt: null, title: null },
				{
					type: "mdxJsxFlowElement",
					name: "img",
					attributes: [{ type: "mdxJsxAttribute", name: "src", value: imageUrl }],
					children: [],
				},
				{
					type: "mdxJsxTextElement",
					name: "a",
					attributes: [{ type: "mdxJsxAttribute", name: "href", value: imageUrl }],
					children: [],
				},
			],
		};

		normalizeImageAssetUrls(input);

		const normalized = toAssetPath(nfdFilename.normalize("NFC"));
		expect(input.children[0]).toMatchObject({ type: "image", url: normalized });
		expect(input.children[1]).toMatchObject({
			type: "mdxJsxFlowElement",
			attributes: [{ type: "mdxJsxAttribute", name: "src", value: normalized }],
		});
		expect(input.children[2]).toMatchObject({
			type: "mdxJsxTextElement",
			attributes: [{ type: "mdxJsxAttribute", name: "href", value: normalized }],
		});
	});
});
