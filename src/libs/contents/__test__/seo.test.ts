import { describe, expect, it } from "vitest";
import { normalizeCanonicalUrl, readSeoMetadata, SEO_METADATA_KEYS } from "../seo";

describe("M7-FE-2 SEO metadata 해석", () => {
	it("SEO 값이 없으면 undefined를 돌려준다", () => {
		expect(readSeoMetadata({})).toBeUndefined();
		expect(readSeoMetadata({ title: "글", summary: "요약", categoryId: "cat-1" })).toBeUndefined();
	});

	it("입력한 값만 담고 앞뒤 공백을 다듬는다", () => {
		expect(readSeoMetadata({ seoTitle: "  검색 제목  ", seoDescription: "설명" })).toEqual({
			title: "검색 제목",
			description: "설명",
		});
	});

	it("빈 문자열·공백만 있는 값은 없는 것으로 본다", () => {
		expect(readSeoMetadata({ seoTitle: "   ", seoDescription: "", canonicalUrl: "", ogImageId: "  " })).toBeUndefined();
	});

	it("사이트 내 경로와 http(s) 절대 URL은 canonical로 통과한다", () => {
		expect(normalizeCanonicalUrl("/posts/hello")).toBe("/posts/hello");
		expect(normalizeCanonicalUrl("  /posts/hello  ")).toBe("/posts/hello");
		expect(normalizeCanonicalUrl("https://dev.to/crosspost")).toBe("https://dev.to/crosspost");
		expect(normalizeCanonicalUrl("http://localhost:3000/posts/a")).toBe("http://localhost:3000/posts/a");
	});

	it("위험한 스킴·프로토콜 상대·해석 불가 값은 버린다", () => {
		expect(normalizeCanonicalUrl("javascript:alert(1)")).toBeNull();
		expect(normalizeCanonicalUrl("data:text/html,x")).toBeNull();
		expect(normalizeCanonicalUrl("ftp://example.com/x")).toBeNull();
		expect(normalizeCanonicalUrl("//evil.example.com/posts/a")).toBeNull();
		expect(normalizeCanonicalUrl("posts/a")).toBeNull();
		expect(normalizeCanonicalUrl("")).toBeNull();
		expect(normalizeCanonicalUrl(undefined)).toBeNull();
	});

	it("역슬래시가 섞인 경로는 다른 origin으로 해석되지 않는다", () => {
		// 브라우저 URL 파서는 특수 스킴에서 `\`를 `/`로 본다 → `/\evil.example`은 `//evil.example`과 같다.
		expect(normalizeCanonicalUrl("/\\evil.example")).toBeNull();
		expect(normalizeCanonicalUrl("\\/evil.example")).toBeNull();
		expect(normalizeCanonicalUrl("/posts/hello")).toBe("/posts/hello");
	});

	it("제어문자·공백은 canonical 경로에서 정리된 형태로만 남는다", () => {
		expect(normalizeCanonicalUrl("/posts/\u0001a")).toBe("/posts/%01a");
		expect(normalizeCanonicalUrl("/posts/\t b")).toBe("/posts/%20b");
		expect(normalizeCanonicalUrl("https://example.com/a\\b")).not.toContain("\\");
	});

	it("잘못된 canonical만 있으면 나머지 SEO 값은 남기고 canonical만 버린다", () => {
		expect(readSeoMetadata({ seoTitle: "제목", canonicalUrl: "javascript:alert(1)" })).toEqual({ title: "제목" });
		expect(readSeoMetadata({ canonicalUrl: "javascript:alert(1)" })).toBeUndefined();
	});

	it("ogImageId도 함께 저장한다(렌더 해석은 v2)", () => {
		expect(readSeoMetadata({ ogImageId: " media-1 " })).toEqual({ ogImageId: "media-1" });
	});

	it("키 목록은 컬렉션 레지스트리·공개 allowlist와 같은 4개다", () => {
		expect([...SEO_METADATA_KEYS].sort()).toEqual(["canonicalUrl", "ogImageId", "seoDescription", "seoTitle"]);
	});
});
