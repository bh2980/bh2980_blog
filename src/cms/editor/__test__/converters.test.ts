import { describe, expect, it } from "vitest";
import { BLOCK_CONVERTERS, converterForCms, converterForTiptap } from "../converters";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

describe("블록 변환기 등록부(v2 C0)", () => {
	it("같은 노드 타입을 두 변환기가 맡지 않는다", () => {
		const cms = BLOCK_CONVERTERS.flatMap((c) => c.cmsTypes);
		const tiptap = BLOCK_CONVERTERS.flatMap((c) => c.tiptapTypes);
		expect(new Set(cms).size).toBe(cms.length);
		expect(new Set(tiptap).size).toBe(tiptap.length);
	});

	it("타입으로 변환기를 찾는다", () => {
		expect(converterForCms("image")?.name).toBe("image");
		expect(converterForTiptap("codeBlock")?.name).toBe("codeBlock");
		expect(converterForCms("paragraph")).toBeUndefined();
	});

	it.each([
		["이미지", '::image{mediaId="m1" alt="고양이" width="50%" align="left"}'],
		["코드 블록", '```ts title="a.ts"\nconst a = 1;\n```'],
		["표", "| a | b |\n| :-- | --: |\n| 1 | 2 |"],
	])("%s를 왕복한다", (_, source) => {
		expect(tiptapToMdx(mdxToTiptap(source)).trim()).toBe(source);
	});
});
