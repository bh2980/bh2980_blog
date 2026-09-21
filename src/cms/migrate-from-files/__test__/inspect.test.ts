import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectLegacyCorpus } from "@/cms/migrate-from-files/inspect";
import { createFixtureCorpus } from "./fixture-corpus";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const warningCounts = (report: ReturnType<typeof inspectLegacyCorpus>) => {
	const counts: Record<string, number> = {};
	for (const warning of report.issues.warnings) counts[warning.code] = (counts[warning.code] ?? 0) + 1;
	return counts;
};

describe("legacy corpus inspection", () => {
	it("이미지 파일 존재·크기·해시와 코드펜스/표 개수를 보고한다", () => {
		const fixture = createFixtureCorpus();
		try {
			const report = inspectLegacyCorpus(fixture.root);
			expect(report.issues.blocking).toEqual([]);
			expect(report.counts).toMatchObject({
				posts: 1,
				memos: 1,
				images: 1,
				imagesMissing: 0,
				codeFences: 1,
				tables: 1,
			});

			const image = report.images[0];
			expect(image?.exists).toBe(true);
			expect(image?.byteSize).toBeGreaterThan(0);
			expect(image?.sha256).toMatch(/^[0-9a-f]{64}$/);
			expect(image?.mimeType).toBe("image/png");
			expect(image?.referencedBy).toEqual(["src/contents/posts/첫-글.mdx"]);
		} finally {
			fixture.cleanup();
		}
	});

	it("빈 alt와 없는 이미지 파일을 경고로 남긴다", () => {
		const fixture = createFixtureCorpus({ imageAlt: "", missingImageFile: true });
		try {
			const report = inspectLegacyCorpus(fixture.root);
			expect(warningCounts(report)).toMatchObject({ empty_image_alt: 1, missing_image_file: 1 });
			expect(report.counts.imagesMissing).toBe(1);
			expect(report.issues.blocking).toEqual([]);
		} finally {
			fixture.cleanup();
		}
	});

	it("해석되지 않는 태그/카테고리/모음집 항목은 blocking으로 보고한다", () => {
		const fixture = createFixtureCorpus({ postTags: ["없는태그"], collectionItems: ["없는메모"] });
		try {
			const report = inspectLegacyCorpus(fixture.root);
			const codes = report.issues.blocking.map((issue) => issue.code);
			expect(codes).toContain("missing_tag");
			expect(codes).toContain("missing_collection_item");
		} finally {
			fixture.cleanup();
		}
	});
});

describe("실제 src/contents 검사 (M0-INV-3 대조)", () => {
	it("M0 집계와 같은 수치를 내고 blocking이 없다", () => {
		const report = inspectLegacyCorpus(REPO_ROOT);

		expect(report.counts).toMatchObject({
			posts: 7,
			memos: 42,
			categories: 3,
			tags: 22,
			collections: 1,
			mdxItems: 49,
			images: 22,
			imagesMissing: 0,
			imagesEmptyAlt: 22,
			codeFences: 166,
			blockMath: 1,
			jsxComponents: 9,
		});
		expect(report.issues.blocking).toEqual([]);
		expect(warningCounts(report)).toEqual({ empty_image_alt: 22, empty_tags: 1, draft_status: 1 });
		expect(Object.keys(report.slugSets)).toHaveLength(5);
		expect(report.slugSets.posts).toHaveLength(7);
		expect(report.slugSets.memos).toHaveLength(42);
		expect(report.slugSets.categories).toEqual(["development", "essay", "review"]);
	});

	it("percent-encoding된 이미지 경로를 실제 파일로 해석한다", () => {
		const report = inspectLegacyCorpus(REPO_ROOT);
		const encoded = report.images.find((image) => image.sourcePath.includes("%"));
		expect(encoded).toBeDefined();
		expect(encoded?.exists).toBe(true);
		expect(encoded?.sha256).toMatch(/^[0-9a-f]{64}$/);
	});
});
