import { describe, expect, it } from "vitest";
import { prepareSnapshot } from "@/cms/core/snapshot";
import { mdxToTiptap, tiptapToMdx } from "@/cms/editor/tiptap-content";
import { analyze } from "@/cms/mdx";
import { readSamples } from "@/cms/mdx/__test__/fixtures/samples";
import { withTranslationHints } from "../hints";

describe("새 번역본의 번역 안내(v3)", () => {
	it("글자는 안내로 감싸고 구조·코드·상자 제목은 그대로 둔다", () => {
		const out = withTranslationHints(
			[
				"## 제목",
				"문단 **굵게** [링크](https://example.com)",
				':::callout{variant="note" title="알림"}\n- 하나\n- 둘\n:::',
				"```ts\nconst a = 1; // 주석\n```",
			].join("\n\n"),
		);
		expect(out).toContain("## :untranslated[제목]");
		expect(out).toContain(':::callout{variant="note" title="알림"}');
		expect(out).toContain("- :untranslated[하나]");
		expect(out).toContain("```ts\nconst a = 1; // 주석\n```");
		// 이어진 안내 글은 한 표시로 합쳐지고, 굵게·링크 같은 서식은 안쪽에 남는다.
		expect(out).toContain(":untranslated[문단 **굵게**] :untranslated[[링크](https://example.com)]");
		expect(analyze(out).errors).toEqual([]);
	});

	it("실제 글 모두: 안내를 단 본문이 오류 없이 읽히고 에디터를 오가도 같다", () => {
		const problems: string[] = [];
		for (const { name, mdx } of readSamples()) {
			const hinted = withTranslationHints(mdx);
			if (analyze(hinted).errors.length > 0) problems.push(`${name}: 읽기 오류`);
			else if (tiptapToMdx(mdxToTiptap(hinted)) !== tiptapToMdx(mdxToTiptap(tiptapToMdx(mdxToTiptap(hinted)))))
				problems.push(`${name}: 에디터 왕복이 흔들림`);
		}
		expect(problems).toEqual([]);
	});

	it("안내 글이 남아 있으면 발행 전 검사가 알린다", async () => {
		const snapshot = await prepareSnapshot({
			collection: "memo",
			slug: "hint",
			metadata: { title: "T" },
			mdx: withTranslationHints("하나\n\n둘\n"),
		} as never);
		expect(snapshot.issues).toContainEqual(expect.objectContaining({ code: "untranslated_text", message: "2곳" }));
	});
});
