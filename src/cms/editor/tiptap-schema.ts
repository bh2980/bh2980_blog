import { Extension } from "@tiptap/core";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";

/**
 * Custom Tiptap extension to safely preserve unknown MDX JSX elements, expressions,
 * and custom block nodes without stripping them or failing validation.
 */
export const CmsMdxPreserver = Extension.create({
	name: "cmsMdxPreserver",
});

/**
 * 새 표현 계약(§4.4)의 인라인·정렬 확장.
 *
 * **스키마 등록 전용이다.** 툴바 버튼과 쓰기 명령은 배치 3(M8-ED-2)에서 켠다 —
 * `tiptap-editor.tsx`가 지금 `editor.getHTML()`을 `mdx`로 저장하므로 읽기/쓰기 전환이 원자적이어야 한다(§9.1.1·§9.1.3).
 * 그러므로 여기서는 `setTextAlign`·`toggleSuperscript` 같은 명령을 **호출하는 코드를 두지 않는다.**
 *
 * A4: `alignments`에 `justify`를 넣지 않는다. 공개 렌더가 `left`·`center`·`right`만 고정 클래스로 지원한다.
 * Tiptap 내부는 인라인 `style`을 쓰지만(확장 기본 동작) 저장 형식은 `:::text-align{align=...}`이다.
 */
export const CmsTextAlign = TextAlign.configure({
	types: ["heading", "paragraph"],
	alignments: ["left", "center", "right"],
	defaultAlignment: null,
});

export const CMS_SCHEMA_EXTENSIONS = [CmsTextAlign, Superscript, Subscript];
