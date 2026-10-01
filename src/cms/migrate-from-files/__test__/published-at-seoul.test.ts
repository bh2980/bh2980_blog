import { describe, expect, it } from "vitest";
import { buildImportPlan } from "@/cms/migrate-from-files/import-plan";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { formatPublishedAt } from "@/utils/format-published-at";

/**
 * Keystatic이 한국 시간을 UTC로 잘못 저장한 값을 이관할 때 KST로 되돌리는지 고정한다.
 * 되돌리지 않으면 발행 48편 중 25편의 표시 날짜가 하루 밀린다.
 */
const REPO_ROOT = process.cwd();

describe("이관 발행일의 KST 해석", () => {
	it("원본이 UTC로 잘못 적힌 wall-clock을 KST로 되돌려 표시 날짜가 유지된다", async () => {
		const corpus = readLegacyCorpus(REPO_ROOT);
		const plan = await buildImportPlan(corpus);

		// 원본은 `…T19:38:00.000Z`인데 의도한 시각은 19:38 KST다.
		const source = corpus.memos.find((item) => item.publishedAt === "2026-01-05T19:38:00.000Z");
		expect(source).toBeDefined();

		const item = plan.items.find((entry) => entry.slug === source?.slug);
		const publishedAt = item?.publishedAt?.toISOString();
		expect(publishedAt).toBe("2026-01-05T10:38:00.000Z");

		// 표시 날짜가 원본 wall-clock과 같은 날이어야 한다(그대로 두면 1월 6일이 된다).
		expect(formatPublishedAt(publishedAt as string)).toContain("1월 5일");
		expect(formatPublishedAt("2026-01-05T19:38:00.000Z")).toContain("1월 6일");
	});

	it("공개 시각 컬럼도 같은 순간을 가리킨다", async () => {
		const plan = await buildImportPlan(readLegacyCorpus(REPO_ROOT));
		const item = plan.items.find((entry) => entry.slug === "10-tuple-to-union");

		// 2026-01-05 19:38 KST = 2026-01-05 10:38 UTC
		expect(item?.publishedAt?.toISOString()).toBe("2026-01-05T10:38:00.000Z");
	});
});
