import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildImportPlan } from "@/cms/migrate-from-files/import-plan";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { stableId } from "@/cms/migrate-from-files/stable-id";
import { createFixtureCorpus } from "./fixture-corpus";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

describe("stable id", () => {
	it("같은 kind+경로면 언제나 같은 UUIDv5를 만든다", () => {
		const first = stableId("post", "src/contents/posts/a.mdx");
		expect(first).toBe(stableId("post", "src/contents/posts/a.mdx"));
		expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it("kind가 다르면 ID가 다르고, slug가 아니라 경로가 키다", () => {
		expect(stableId("post", "src/contents/posts/a.mdx")).not.toBe(stableId("memo", "src/contents/posts/a.mdx"));
		expect(stableId("post", "src/contents/posts/a.mdx")).not.toBe(stableId("post", "src/contents/posts/b.mdx"));
	});

	it("NFC 정규화된 경로는 같은 ID가 된다", () => {
		const composed = "src/contents/memos/한글.mdx";
		const decomposed = composed.normalize("NFD");
		expect(decomposed).not.toBe(composed);
		expect(stableId("memo", decomposed)).toBe(stableId("memo", composed));
	});
});

describe("import plan", () => {
	it("published 항목은 working+published를, draft는 working만 만든다", async () => {
		const fixture = createFixtureCorpus({ memoStatus: null });
		try {
			const plan = await buildImportPlan(readLegacyCorpus(fixture.root));

			expect(plan.blocking).toEqual([]);
			expect(plan.counts).toMatchObject({
				posts: 1,
				memos: 1,
				categories: 1,
				tags: 2,
				collections: 1,
				published: 5,
				draft: 1,
				items: 6,
			});

			const post = plan.items.find((item) => item.collection === "post");
			expect(post?.status).toBe("published");
			expect(post?.published).toBeDefined();
			expect(post?.publishedAt?.toISOString()).toBe("2026-01-02T03:04:00.000Z");
			expect(post?.working.metadata).toMatchObject({ title: "첫 글", policy: "normal" });

			const memo = plan.items.find((item) => item.collection === "memo");
			expect(memo?.status).toBe("draft");
			expect(memo?.published).toBeUndefined();
			// 초안이어도 원본 날짜는 작업본 메타데이터에만 남고 공개 시각 컬럼은 null이다.
			expect(memo?.publishedAt).toBeNull();
			expect(memo?.working.metadata).toMatchObject({ publishedAt: "2026-01-03T03:04:00.000Z" });
		} finally {
			fixture.cleanup();
		}
	});

	it("관계 참조를 metadata 기반으로 만들고 모음집 itemIds를 memo ID로 해석한다", async () => {
		const fixture = createFixtureCorpus();
		try {
			const plan = await buildImportPlan(readLegacyCorpus(fixture.root));
			const memoId = plan.ids.memo.get("메모-하나") as string;
			const collection = plan.items.find((item) => item.collection === "collection");
			expect(collection?.working.metadata).toMatchObject({ itemIds: [memoId] });

			const post = plan.items.find((item) => item.collection === "post");
			expect(post?.references.some((ref) => ref.kind === "category")).toBe(true);
			expect(post?.references.some((ref) => ref.kind === "tag")).toBe(true);
			expect(post?.id).toBe(stableId("post", "src/contents/posts/첫-글.mdx"));
		} finally {
			fixture.cleanup();
		}
	});

	it("없는 태그·카테고리·모음집 항목은 blocking으로 보고한다", async () => {
		const fixture = createFixtureCorpus({ collectionItems: ["없는-메모"] });
		try {
			const plan = await buildImportPlan(readLegacyCorpus(fixture.root));
			expect(plan.blocking.map((issue) => issue.code)).toContain("missing_collection_item");

			const tags = plan.items.find((item) => item.collection === "collection");
			expect(tags?.working.metadata).not.toHaveProperty("itemIds");
		} finally {
			fixture.cleanup();
		}
	});

	it("게시글에 카테고리가 없으면 blocking으로 보고한다", async () => {
		const fixture = createFixtureCorpus({ postCategory: "" });
		try {
			const plan = await buildImportPlan(readLegacyCorpus(fixture.root));
			expect(plan.blocking.map((issue) => issue.code)).toContain("missing_category");
		} finally {
			fixture.cleanup();
		}
	});
});

describe("실제 src/contents 전편", () => {
	it("전편이 blocking 없이 계획되고 slug·상태가 유지된다", async () => {
		const corpus = readLegacyCorpus(REPO_ROOT);
		const plan = await buildImportPlan(corpus);

		expect(plan.blocking).toEqual([]);
		expect(plan.counts).toMatchObject({
			posts: 7,
			memos: 42,
			categories: 3,
			tags: 22,
			collections: 1,
			draft: 1,
			items: 75,
		});

		// 모든 원본 slug이 그대로 남는다.
		const planned = new Set(plan.items.map((item) => `${item.collection}/${item.slug}`));
		for (const item of [
			...corpus.posts,
			...corpus.memos,
			...corpus.categories,
			...corpus.tags,
			...corpus.collections,
		]) {
			expect(planned.has(`${item.kind}/${item.slug}`)).toBe(true);
		}

		// 원본 파일은 그대로다.
		const sample = corpus.posts[0];
		expect(sample).toBeDefined();
		expect(readFileSync(path.join(REPO_ROOT, sample?.path as string), "utf8")).toContain(sample?.title as string);
	});
});
