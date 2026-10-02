import { describe, expect, it } from "vitest";
import { contentPath, LINKABLE_COLLECTIONS, parseContentPath, parseInternalLink } from "../links";

// 예시 설정(`test/cms.config.ts`): 게시글 `/posts/:slug`, 메모 `/memos/:slug`, 사이트 `https://bh2980.dev`(+www).
describe("본문 내부 링크 규칙", () => {
	it("경로가 있는 컬렉션만 링크로 가리킬 수 있다", () => {
		expect(LINKABLE_COLLECTIONS).toEqual(["post", "memo"]);
		expect(contentPath("post", "nextjs-guide")).toBe("/posts/nextjs-guide");
		expect(contentPath("memo", "한글 메모")).toBe("/memos/한글%20메모");
		expect(contentPath("tag", "react")).toBeNull();
		expect(contentPath("post", "")).toBeNull();
	});

	it("경로에서 컬렉션과 slug를 읽는다", () => {
		expect(parseContentPath("/posts/a")).toEqual({ collection: "post", slug: "a" });
		expect(parseContentPath("/memos/%ED%95%9C%EA%B8%80/")).toEqual({ collection: "memo", slug: "한글" });
		expect(parseContentPath("/posts/a/b")).toBeNull();
		expect(parseContentPath("/tags/react")).toBeNull();
		expect(parseContentPath("/posts/%E0%A4%A")).toBeNull();
	});

	it("경로와 사이트 주소로 적은 링크만 내부 링크로 본다", () => {
		expect(parseInternalLink("/posts/a?x=1#h")).toEqual({ collection: "post", slug: "a", url: "/posts/a?x=1#h" });
		expect(parseInternalLink("https://www.bh2980.dev/memos/b")?.slug).toBe("b");
		expect(parseInternalLink("//bh2980.dev/posts/c")?.slug).toBe("c");
		expect(parseInternalLink("https://example.com/posts/a")).toBeNull();
		expect(parseInternalLink("mailto:me@bh2980.dev")).toBeNull();
		expect(parseInternalLink("posts/a")).toBeNull();
	});
});
