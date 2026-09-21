import { describe, expect, it } from "vitest";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { createFixtureCorpus } from "./fixture-corpus";

describe("legacy corpus parser", () => {
	it("post/memo 본문과 frontmatter를 읽고 status 누락은 draft로 본다", () => {
		const fixture = createFixtureCorpus({ memoStatus: null });
		try {
			const corpus = readLegacyCorpus(fixture.root);

			expect(corpus.posts).toHaveLength(1);
			const post = corpus.posts[0];
			expect(post?.slug).toBe("첫-글");
			expect(post?.title).toBe("첫 글");
			expect(post?.status).toBe("published");
			expect(post?.publishedAt).toBe("2026-01-02T03:04:00.000Z");
			expect(post?.categorySlug).toBe("development");
			expect(post?.tagSlugs).toEqual(["blog"]);
			expect(post?.policy).toBe("normal");
			expect(post?.mdx).toContain("## 본문");
			expect(post?.mdx).toContain("본문 내용");

			const memo = corpus.memos[0];
			expect(memo?.status).toBe("draft");
			expect(memo?.categorySlug).toBeNull();
			expect(memo?.tagSlugs).toEqual(["blog"]);
		} finally {
			fixture.cleanup();
		}
	});

	it("record YAML과 legacy 모음집 meta.value.memo 형식을 읽는다", () => {
		const fixture = createFixtureCorpus({ collectionItems: ["메모-하나"] });
		try {
			const corpus = readLegacyCorpus(fixture.root);

			expect(corpus.categories.map((item) => [item.slug, item.title])).toEqual([["development", "개발"]]);
			expect(corpus.tags.map((item) => item.slug).sort()).toEqual(["blog", "extra"]);
			expect(corpus.collections).toHaveLength(1);
			expect(corpus.collections[0]?.title).toBe("모음");
			expect(corpus.collections[0]?.itemSlugs).toEqual(["메모-하나"]);
			expect(corpus.categories[0]?.status).toBe("published");
		} finally {
			fixture.cleanup();
		}
	});

	it("policy가 없으면 null로 둔다", () => {
		const fixture = createFixtureCorpus({ postPolicy: null });
		try {
			expect(readLegacyCorpus(fixture.root).posts[0]?.policy).toBeNull();
		} finally {
			fixture.cleanup();
		}
	});
});
