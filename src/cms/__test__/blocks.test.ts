import { DIRECTIVES } from "@monti-cms/core/mdx";
import { describe, expect, it } from "vitest";

/**
 * 블로그 설정이 등록하는 지시자 표. 블록 정의·구현 정합성 검사는 `packages/cms-blocks/src/__test__/block-definitions.test.tsx`가
 * 라이브러리 기본 구현으로 본다. 여기서는 블로그 설정(`plugins` 순서)이 같은 표를 만드는지만 본다.
 */
describe("블로그 설정의 지시자 표", () => {
	it("v1 지시자 표(§4.4)를 그대로 만든다", () => {
		expect(
			DIRECTIVES.map((directive) => [directive.name, directive.kind, directive.component, directive.required]),
		).toEqual([
			["text-align", "container", "TextAlign", ["align"]],
			["image", "leaf", "Image", []],
			["file", "leaf", "File", ["mediaId"]],
			// 번역 안내 글(v3). 새 번역본의 원문 글을 감싼다.
			["untranslated", "text", "Untranslated", []],
			["u", "text", "u", []],
			["sup", "text", "sup", []],
			["sub", "text", "sub", []],
			["br", "text", "br", []],
			["table", "container", "Table", []],
			["row", "container", "TableRow", []],
			["cell", "leaf", "TableCell", []],
			// 블록 확장(`@monti-cms/blocks`). 블로그 설정의 `plugins` 순서다.
			["callout", "container", "Callout", []],
			["collapsible", "container", "Collapsible", []],
			["tabs", "container", "Tabs", []],
			["tab", "container", "Tab", ["label"]],
			["columns", "container", "Columns", []],
			["column", "container", "Column", []],
			// 글자 꾸밈 확장(M10-3에서 본체에서 옮겼다). 저장 문법·컴포넌트 이름은 그대로다.
			["tooltip", "text", "Tooltip", ["content"]],
			["code-ref", "text", "CodeRef", ["to"]],
			["color", "text", "Color", []],
		]);
		expect(DIRECTIVES.find((directive) => directive.name === "cell")?.attributes).toEqual({
			colspan: "string",
			rowspan: "string",
			header: "boolean",
		});
		expect(DIRECTIVES.find((directive) => directive.name === "image")?.attributes).toEqual({
			mediaId: "string",
			src: "string",
			alt: "string",
			width: "string",
			align: "string",
			caption: "string",
			decorative: "boolean",
			crop: "string",
			rotate: "string",
			title: "string",
		});
	});
});
