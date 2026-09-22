import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CMS_SCHEMA_EXTENSIONS, CmsOpaqueBlock, CmsTextAlign, CmsTooltipMark } from "../tiptap-schema";

const schema = getSchema([StarterKit.configure({ heading: { levels: [1, 2, 3] } }), ...CMS_SCHEMA_EXTENSIONS]);

/**
 * 배치 3(M8-ED-2)에서 쓰기 명령을 켰다 — 에디터가 `toDocument`/`serialize` 경로로 저장하므로
 * 읽기/쓰기 전환이 원자적이다(§9.1.1·§9.1.3). 이 테스트는 그 경계를 고정한다.
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

	it("쓰기 단축키가 켜져 있다(배치 3에서 활성화)", () => {
		// Sup·Sub·TextAlign은 기본 단축키(Mod-.·Mod-,·Mod-Shift-l/e/r)를 갖는다.
		// 배치 1(R1 P2)에서 스키마 등록만으로 실에디터에 단축키가 동작하므로 막았고,
		// 배치 3에서 저장 경로가 바뀌어 정식으로 켠다.
		const names = CMS_SCHEMA_EXTENSIONS.map((extension) => extension.name);
		for (const name of ["superscript", "subscript", "textAlign"]) {
			const extension = CMS_SCHEMA_EXTENSIONS[names.indexOf(name)] as {
				config: { addKeyboardShortcuts?: () => Record<string, unknown> };
			};
			expect(Object.keys(extension.config.addKeyboardShortcuts?.() ?? {})).not.toEqual([]);
		}
	});

	it("에디터가 이 확장들을 실제로 싣는다", () => {
		expect(CMS_SCHEMA_EXTENSIONS).toHaveLength(6);
		expect(CMS_SCHEMA_EXTENSIONS.map((extension) => extension.name).sort()).toEqual([
			"cmsOpaqueBlock",
			"cmsTooltip",
			"codeBlock",
			"subscript",
			"superscript",
			"textAlign",
		]);
		expect(CmsOpaqueBlock.name).toBe("cmsOpaqueBlock");
		expect(CmsTooltipMark.name).toBe("cmsTooltip");
	});
});
