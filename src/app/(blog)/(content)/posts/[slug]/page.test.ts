import { describe, expect, it, vi } from "vitest";

/**
 * M9 회귀 방지: 한글 slug가 500이 되던 원인.
 *
 * Next는 동적 세그먼트를 **퍼센트 인코딩된 채로** 넘긴다(`%EB%B8%94…`). 조회는 리포지토리가
 * 디코딩해서 성공하는데, 페이지가 원문을 그대로 `post.slug`와 비교하면 매번 alias로 오인해
 * 리다이렉트하고, 그 대상(한글)이 `location` 헤더에 들어가 `ERR_INVALID_CHAR`로 500이 난다.
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

const getPost = vi.fn();
vi.mock("@/libs/contents/services/post", () => ({
	getPost: (slug: string) => getPost(slug),
	listPosts: async () => ({ list: [] }),
}));
vi.mock("./post-detail-page-content", () => ({ PostDetailPageContent: () => null }));

const { default: BlogPost } = await import("./page");

const KOREAN_SLUG = "블로그라면-seo는-해봐야지";
const ENCODED = encodeURIComponent(KOREAN_SLUG);

describe("posts/[slug] 페이지의 alias 판정", () => {
	it("퍼센트 인코딩된 한글 slug를 alias로 오인하지 않는다", async () => {
		redirects.length = 0;
		// 리포지토리는 디코딩해서 찾아내고, 정규 slug(한글)를 돌려준다.
		getPost.mockResolvedValue({ slug: KOREAN_SLUG, title: "제목" });

		await BlogPost({ params: Promise.resolve({ slug: ENCODED }) });

		expect(redirects).toEqual([]);
	});

	it("과거 주소는 정규 주소로 308 이동하되 헤더에 넣을 수 있게 인코딩한다", async () => {
		redirects.length = 0;
		getPost.mockResolvedValue({ slug: KOREAN_SLUG, title: "제목" });

		await expect(BlogPost({ params: Promise.resolve({ slug: "old-alias" }) })).rejects.toThrow(/REDIRECT:/);

		expect(redirects).toHaveLength(1);
		// 헤더에 비ASCII가 들어가면 ERR_INVALID_CHAR로 500이 난다.
		expect(redirects[0]).toBe(`/posts/${ENCODED}`);
		expect(/^[\x20-\x7E]*$/.test(redirects[0])).toBe(true);
	});
});
