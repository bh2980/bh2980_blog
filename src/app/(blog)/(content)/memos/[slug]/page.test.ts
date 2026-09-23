import { describe, expect, it, vi } from "vitest";

/**
 * M9 회귀 방지: 한글 slug가 500이 되던 원인(메모 쪽).
 *
 * posts와 같은 코드 경로지만 별도 페이지라 따로 고정한다. Next는 동적 세그먼트를
 * **퍼센트 인코딩된 채로** 넘기므로, 조회는 성공하는데 페이지가 원문을 그대로 `memo.slug`와
 * 비교하면 매번 alias로 오인해 리다이렉트하고, 그 대상(한글)이 `location` 헤더에 들어가
 * `ERR_INVALID_CHAR`로 500이 난다.
 */
const redirects: string[] = [];

vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new Error("NOT_FOUND");
	},
	permanentRedirect: (target: string) => {
		redirects.push(target);
		throw new Error(`REDIRECT:${target}`);
	},
}));

const getMemo = vi.fn();
vi.mock("@/libs/contents/services/memo", () => ({
	getMemo: (slug: string) => getMemo(slug),
	listMemos: async () => ({ list: [] }),
}));
vi.mock("./memo-detail-page-content", () => ({ MemoDetailPageContent: () => null }));

const { default: MemoPage } = await import("./page");

const KOREAN_SLUG = "정규표현식-정리";
const ENCODED = encodeURIComponent(KOREAN_SLUG);

describe("memos/[slug] 페이지의 alias 판정", () => {
	it("퍼센트 인코딩된 한글 slug를 alias로 오인하지 않는다", async () => {
		redirects.length = 0;
		getMemo.mockResolvedValue({ slug: KOREAN_SLUG, title: "제목" });

		await MemoPage({ params: Promise.resolve({ slug: ENCODED }) });

		expect(redirects).toEqual([]);
	});

	it("과거 주소는 정규 주소로 308 이동하되 헤더에 넣을 수 있게 인코딩한다", async () => {
		redirects.length = 0;
		getMemo.mockResolvedValue({ slug: KOREAN_SLUG, title: "제목" });

		await expect(MemoPage({ params: Promise.resolve({ slug: "old-alias" }) })).rejects.toThrow(/REDIRECT:/);

		expect(redirects).toHaveLength(1);
		expect(redirects[0]).toBe(`/memos/${ENCODED}`);
		expect(/^[\x20-\x7E]*$/.test(redirects[0])).toBe(true);
	});

	it("없는 글은 notFound로 넘긴다", async () => {
		getMemo.mockResolvedValue(null);

		await expect(MemoPage({ params: Promise.resolve({ slug: "없는글" }) })).rejects.toThrow("NOT_FOUND");
	});
});
