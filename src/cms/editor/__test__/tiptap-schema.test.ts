import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CMS_SCHEMA_EXTENSIONS, CmsTextAlign } from "../tiptap-schema";

const schema = getSchema([StarterKit.configure({ heading: { levels: [1, 2, 3] } }), ...CMS_SCHEMA_EXTENSIONS]);

/**
 * 배치 1은 **스키마 등록만** 한다. 툴바 버튼과 쓰기 명령은 배치 3(M8-ED-2)에서 켠다 —
 * 에디터가 지금 `getHTML()`을 `mdx`로 저장하므로 읽기/쓰기 전환이 원자적이어야 한다.
 * 이 테스트는 그 경계를 고정한다: 확장은 등록되어 있지만 **정렬을 쓰는 코드는 없다.**
 */
describe("에디터 스키마에 새 표현 확장 등록", () => {
	it("위·아래첨자 mark가 스키마에 있다", () => {
		expect(Object.keys(schema.marks)).toEqual(expect.arrayContaining(["superscript", "subscript"]));
	});

	it("제목·문단에 textAlign 속성이 있고 기본값은 없다", () => {
		// 기본값이 null이라 정렬하지 않은 본문은 `style` 없이 저장된다.
		expect(schema.nodes.heading.spec.attrs?.textAlign?.default).toBeNull();
		expect(schema.nodes.paragraph.spec.attrs?.textAlign?.default).toBeNull();
	});

	it("허용 정렬은 left·center·right 뿐이다(justify 금지, A4)", () => {
		expect(CmsTextAlign.options.alignments).toEqual(["left", "center", "right"]);
		expect(CmsTextAlign.options.types).toEqual(["heading", "paragraph"]);
	});

	it("에디터가 이 확장들을 실제로 싣는다", () => {
		expect(CMS_SCHEMA_EXTENSIONS).toHaveLength(3);
		expect(CMS_SCHEMA_EXTENSIONS.map((extension) => extension.name).sort()).toEqual([
			"subscript",
			"superscript",
			"textAlign",
		]);
	});
});
