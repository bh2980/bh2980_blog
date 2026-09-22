import { describe, expect, it } from "vitest";
import { paginate, publicEntriesQuerySchema, toPublicAddress, toPublicMemo, toPublicPost } from "../public-api";
import type { DraftPost, PublishedMemo, PublishedPost } from "../types/contents";

const CATEGORY = { slug: "engineering", label: "엔지니어링" };
const TAG = { slug: "typescript", label: "TypeScript" };

function post(overrides: Partial<PublishedPost> = {}): PublishedPost {
	return {
		slug: "hello",
		status: "published",
		publishedAt: "2026-03-01T12:00:00.000Z",
		title: "안녕",
		excerpt: "요약",
		category: CATEGORY,
		tags: [TAG],
		contentMdx: "# 본문",
		...overrides,
	};
}

function memo(overrides: Partial<PublishedMemo> = {}): PublishedMemo {
	return {
		slug: "memo-1",
		status: "published",
		publishedAt: "2026-03-02T12:00:00.000Z",
		title: "메모",
		tags: [TAG],
		contentMdx: "메모 본문",
		...overrides,
	};
}

describe("M7-BE-3 공개 DTO", () => {
	it("목록 직렬화에는 본문이 없다", () => {
		const dto = toPublicPost(post(), { includeBody: false });

		expect(dto).not.toBeNull();
		expect(Object.hasOwn(dto as object, "body")).toBe(false);
		expect(JSON.stringify(dto)).not.toContain("본문");
	});

	it("상세 직렬화에는 본문이 있다", () => {
		expect(toPublicPost(post(), { includeBody: true })?.body).toBe("# 본문");
		expect(toPublicMemo(memo(), { includeBody: true })?.body).toBe("메모 본문");
	});

	it("초안은 공개 DTO로 만들 수 없다(fail-closed)", () => {
		const draft: DraftPost = { ...post(), status: "draft" };

		expect(toPublicPost(draft, { includeBody: true })).toBeNull();
	});

	it("공개 응답에 관리자 전용 키가 없다", () => {
		const dto = toPublicPost(post(), { includeBody: true });
		const keys = Object.keys(dto as object);

		for (const forbidden of [
			"version",
			"folderId",
			"working",
			"published",
			"status",
			"contentMdx",
			"createdAt",
			"updatedAt",
			"id",
		]) {
			expect(keys).not.toContain(forbidden);
		}
	});

	it("post는 요약·카테고리를 싣고 memo는 싣지 않는다", () => {
		const postDto = toPublicPost(post(), { includeBody: false });
		expect(postDto?.collection).toBe("post");
		expect(postDto?.excerpt).toBe("요약");
		expect(postDto?.category).toEqual(CATEGORY);

		const memoDto = toPublicMemo(memo(), { includeBody: false });
		expect(memoDto?.collection).toBe("memo");
		expect(Object.hasOwn(memoDto as object, "category")).toBe(false);
		expect(Object.hasOwn(memoDto as object, "excerpt")).toBe(false);
	});

	it("SEO 메타와 isEvergreen은 공개 응답에 실린다", () => {
		const dto = toPublicPost(post({ seo: { title: "검색 제목", canonicalUrl: "/posts/hello" }, isEvergreen: true }), {
			includeBody: false,
		});

		expect(dto?.seo).toEqual({ title: "검색 제목", canonicalUrl: "/posts/hello" });
		expect(dto?.isEvergreen).toBe(true);
	});

	it("별칭 판정은 요청 slug와 정규 slug 비교다", () => {
		expect(toPublicAddress("old-post", "new-post")).toEqual({ slug: "new-post", isAlias: true });
		expect(toPublicAddress("same", "same")).toEqual({ slug: "same", isAlias: false });
	});

	it("페이지네이션은 전체 개수를 유지하고 잘라낸다", () => {
		const items = Array.from({ length: 30 }, (_, index) => index);

		expect(paginate(items, 1, 25)).toEqual({ items: items.slice(0, 25), total: 30, page: 1, pageSize: 25 });
		expect(paginate(items, 2, 25)).toEqual({ items: items.slice(25, 30), total: 30, page: 2, pageSize: 25 });
		expect(paginate([], 1, 25)).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
	});

	it("질의 스키마는 §10.1 기본값을 채운다", () => {
		expect(publicEntriesQuerySchema.parse({})).toEqual({ collection: "post", page: 1, pageSize: 25 });
		expect(publicEntriesQuerySchema.parse({ collection: "memo", tag: "ts", page: "2", pageSize: "50" })).toEqual({
			collection: "memo",
			tag: "ts",
			page: 2,
			pageSize: 50,
		});
	});

	it("질의 스키마는 지원하지 않는 컬렉션과 범위 밖 값을 거부한다", () => {
		expect(publicEntriesQuerySchema.safeParse({ collection: "category" }).success).toBe(false);
		expect(publicEntriesQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
		expect(publicEntriesQuerySchema.safeParse({ page: "0" }).success).toBe(false);
		expect(publicEntriesQuerySchema.safeParse({ category: "" }).success).toBe(false);
	});
});
