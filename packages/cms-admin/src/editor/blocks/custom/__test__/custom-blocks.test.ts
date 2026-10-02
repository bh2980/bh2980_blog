import { describe, expect, it } from "vitest";
import { buildBlockSlashCommands } from "../../../slash-command";
import { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "../../../tiptap-content";
import { customNodeName } from "..";

// 예시 설정(`packages/cms/test/cms.config.ts`)의 사용자 블록: `notice`(편집기 노드 컨테이너), `embed`(원문 상자).
describe("사용자 블록 편집", () => {
	it("편집기 노드가 있는 사용자 블록은 속성·본문을 노드로 옮기고 그대로 되돌린다", () => {
		const mdx = ':::notice{level="warn" title="점검"}\n오늘 밤 점검합니다.\n:::\n';
		const json = mdxToTiptap(mdx);
		const node = json.content?.[0];
		expect(node?.type).toBe(customNodeName({ name: "notice" }));
		expect(node?.attrs?.values).toEqual({ level: "warn", title: "점검" });
		expect(node?.content?.[0]?.type).toBe("paragraph");
		expect(tiptapToMdx(json)).toBe(mdx);
	});

	it("원문 상자로 정한 사용자 블록은 원문 그대로 보존한다", () => {
		const mdx = '::embed{url="https://example.com/video"}\n';
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});

	it("삽입할 수 있는 사용자 블록이 슬래시 메뉴에 나온다", () => {
		const items = buildBlockSlashCommands();
		expect(items.find((item) => item.id === "notice")?.title).toBe("공지");
		expect(items.some((item) => item.id === "embed")).toBe(false);
	});
});
