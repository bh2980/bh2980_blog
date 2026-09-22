import { describe, expect, it, vi } from "vitest";
import type { ContentStore, PublishedEntryRecord } from "@/cms/adapters/postgres/content-store";
import { PostgresRepository } from "../postgres";

const DATE = new Date("2026-03-01T12:00:00.000Z");
const DATE_ISO = DATE.toISOString();

function record(
	overrides: Partial<PublishedEntryRecord> & { id: string; collection: string; slug: string },
): PublishedEntryRecord {
	return {
		metadata: {},
		mdx: "",
		publishedAt: DATE,
		firstPublishedAt: DATE,
		updatedAt: DATE,
		...overrides,
	};
}

function publishedPostsFixture(): PublishedEntryRecord[] {
	return [
		record({
			id: "post-1",
			collection: "post",
			slug: "first-post",
			mdx: "# 본문 1",
			metadata: {
				title: "첫 글",
				summary: "요약 1",
				categoryId: "cat-1",
				tagIds: ["tag-1", "tag-2"],
				policy: "evergreen",
			},
		}),
		record({
			id: "post-2",
			collection: "post",
			slug: "second-post",
			metadata: { title: "둘째 글", categoryId: "cat-2", tagIds: ["tag-2"] },
		}),
		record({
			id: "post-3",
			collection: "post",
			slug: "orphan-post",
			metadata: { title: "카테고리 없음" },
		}),
		record({ id: "cat-1", collection: "category", slug: "engineering", metadata: { title: "엔지니어링" } }),
		record({ id: "cat-2", collection: "category", slug: "notes", metadata: { title: "기록" } }),
		record({ id: "tag-1", collection: "tag", slug: "typescript", metadata: { title: "TypeScript" } }),
		record({ id: "tag-2", collection: "tag", slug: "react", metadata: { title: "React" } }),
	];
}

function createFakeStore(
	entries: PublishedEntryRecord[],
	hooks: { onList?: () => void; onGetBySlug?: () => void } = {},
): ContentStore {
	const store = {
		listPublishedEntries: async (params: { collections: readonly string[]; includeBody?: boolean }) => {
			hooks.onList?.();

			return entries
				.filter((entry) => params.collections.includes(entry.collection))
				.map((entry) => (params.includeBody === true ? entry : { ...entry, mdx: "" }));
		},
		getPublishedEntryBySlug: async (params: { collection: string; slug: string; includeBody?: boolean }) => {
			hooks.onGetBySlug?.();
			const entry = entries.find(
				(candidate) => candidate.collection === params.collection && candidate.slug === params.slug,
			);

			if (!entry) return { status: "not_found" as const };

			// 실제 store는 includeBody가 false일 때만 본문을 생략한다(단건 조회 기본값은 본문 포함).
			return {
				status: "current" as const,
				entry: params.includeBody === false ? { ...entry, mdx: "" } : entry,
			};
		},
	};

	return store as unknown as ContentStore;
}

function publishedAtOf(entry: { status: string; publishedAt?: string } | null | undefined): string | null {
	return entry?.status === "published" ? (entry.publishedAt ?? null) : null;
}

function repositoryWith(entries: PublishedEntryRecord[], hooks: { onList?: () => void } = {}): PostgresRepository {
	return new PostgresRepository(() => createFakeStore(entries, hooks));
}

describe("M7-BE-1 PostgresRepository 공개 매핑", () => {
	it("게시글을 카테고리·태그·요약·evergreen 여부와 함께 매핑한다", async () => {
		const post = await repositoryWith(publishedPostsFixture()).getPost("first-post");

		expect(post).toEqual({
			slug: "first-post",
			status: "published",
			title: "첫 글",
			excerpt: "요약 1",
			category: { slug: "engineering", label: "엔지니어링" },
			tags: [
				{ slug: "typescript", label: "TypeScript" },
				{ slug: "react", label: "React" },
			],
			contentMdx: "# 본문 1",
			publishedAt: DATE_ISO,
			isEvergreen: true,
		});
	});

	it("metadata.publishedAt이 없으면 DB 발행 시각을 표시 발행일로 쓴다", async () => {
		const memo = await repositoryWith([
			record({ id: "memo-1", collection: "memo", slug: "memo-a", metadata: { title: "메모" } }),
		]).getMemo("memo-a");

		expect(publishedAtOf(memo)).toBe(DATE_ISO);
	});

	it("metadata.publishedAt이 있으면 그 값을 우선한다", async () => {
		const memo = await repositoryWith([
			record({
				id: "memo-1",
				collection: "memo",
				slug: "memo-a",
				metadata: { title: "메모", publishedAt: "2025-12-31T00:00:00.000Z" },
			}),
		]).getMemo("memo-a");

		expect(publishedAtOf(memo)).toBe("2025-12-31T00:00:00.000Z");
	});

	it("카테고리를 해석할 수 없는 게시글은 공개하지 않는다", async () => {
		const fixture = publishedPostsFixture();
		const repository = repositoryWith(fixture);

		await expect(repository.getPost("orphan-post")).resolves.toBeNull();
		await expect(repository.listPosts()).resolves.toHaveLength(2);
	});

	it("발행 시각을 알 수 없는 항목은 공개하지 않는다", async () => {
		const repository = repositoryWith([
			record({
				id: "memo-1",
				collection: "memo",
				slug: "memo-a",
				publishedAt: null,
				firstPublishedAt: null,
			}),
		]);

		await expect(repository.getMemo("memo-a")).resolves.toBeNull();
	});

	it("목록 조회 결과의 본문은 빈 문자열이고 상세 조회에서만 본문을 싣는다", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		const [list, detail] = await Promise.all([repository.listPosts(), repository.getPost("first-post")]);

		expect(list[0].contentMdx).toBe("");
		expect(detail?.contentMdx).toBe("# 본문 1");
	});

	it("listPosts가 카테고리·태그 슬러그로 필터한다", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		const byCategory = await repository.listPosts({ category: "notes" });
		const byTag = await repository.listPosts({ tag: "react" });

		expect(byCategory.map((post) => post.slug)).toEqual(["second-post"]);
		expect(byTag.map((post) => post.slug).sort()).toEqual(["first-post", "second-post"]);
	});

	it("status가 all이어도 초안을 만들지 않는다(공개본만 반환)", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		const all = await repository.listPosts({ status: "all" });

		expect(all.every((post) => post.status === "published")).toBe(true);
	});

	it("메모를 태그와 함께 매핑하고 태그로 필터한다", async () => {
		const fixture = [
			record({
				id: "memo-1",
				collection: "memo",
				slug: "memo-a",
				metadata: { title: "메모 A", tagIds: ["tag-2"] },
			}),
			record({ id: "memo-2", collection: "memo", slug: "memo-b", metadata: { title: "메모 B" } }),
			record({ id: "tag-2", collection: "tag", slug: "react", metadata: { title: "React" } }),
		];
		const repository = repositoryWith(fixture);

		const memo = await repository.getMemo("memo-a");
		const filtered = await repository.listMemos({ tag: "react" });

		expect(memo).toEqual({
			slug: "memo-a",
			status: "published",
			title: "메모 A",
			tags: [{ slug: "react", label: "React" }],
			contentMdx: "",
			publishedAt: DATE_ISO,
		});
		expect(filtered.map((item) => item.slug)).toEqual(["memo-a"]);
	});

	it("series가 itemIds 순서를 보존하고 공개되지 않은 item을 제외한다", async () => {
		const fixture = [
			...publishedPostsFixture(),
			record({
				id: "series-1",
				collection: "collection",
				slug: "type-challenges",
				metadata: { title: "타입 챌린지", itemIds: ["post-2", "missing-post", "orphan-post", "post-1"] },
			}),
		];
		const repository = repositoryWith(fixture);

		const series = await repository.getSeries("type-challenges");

		expect(series?.label).toBe("타입 챌린지");
		expect(series?.items.map((item) => item.slug)).toEqual(["second-post", "first-post"]);
	});

	it("공개 슬러그와 분류 목록을 반환한다", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		await expect(repository.listPostSlugs()).resolves.toEqual(["first-post", "second-post", "orphan-post"]);
		await expect(repository.listTags()).resolves.toEqual([
			{ slug: "typescript", label: "TypeScript" },
			{ slug: "react", label: "React" },
		]);
		await expect(repository.listCategories()).resolves.toEqual([
			{ slug: "engineering", label: "엔지니어링" },
			{ slug: "notes", label: "기록" },
		]);
	});

	it("저장소 오류를 404로 바꾸지 않고 그대로 전파한다", async () => {
		const failing = {
			listPublishedEntries: async () => {
				throw new Error("connection refused");
			},
			getPublishedEntryBySlug: async () => {
				throw new Error("connection refused");
			},
		} as unknown as ContentStore;
		const repository = new PostgresRepository(() => failing);

		await expect(repository.listPosts()).rejects.toThrow("connection refused");
		await expect(repository.getPost("first-post")).rejects.toThrow("connection refused");
	});

	it("게시글 상세 조회는 본문 포함 1회 + 분류 1회만 조회한다", async () => {
		const onList = vi.fn();
		const repository = repositoryWith(publishedPostsFixture(), { onList });

		await repository.getPost("first-post");

		expect(onList).toHaveBeenCalledTimes(1);
	});

	it("SEO metadata를 공개 seo 객체로 옮긴다", async () => {
		const entries = publishedPostsFixture();
		entries.push(
			record({
				id: "post-seo",
				collection: "post",
				slug: "seo-post",
				metadata: {
					title: "SEO 글",
					categoryId: "cat-1",
					seoTitle: "검색 제목",
					seoDescription: "검색 설명",
					canonicalUrl: "https://dev.to/crosspost",
					ogImageId: "media-1",
				},
			}),
		);
		const repository = repositoryWith(entries);

		const post = await repository.getPost("seo-post");

		expect(post?.seo).toEqual({
			title: "검색 제목",
			description: "검색 설명",
			canonicalUrl: "https://dev.to/crosspost",
			ogImageId: "media-1",
		});
	});

	it("메모의 SEO metadata도 공개 seo 객체로 옮긴다", async () => {
		const entries = publishedPostsFixture();
		entries.push(
			record({
				id: "memo-seo",
				collection: "memo",
				slug: "seo-memo",
				metadata: { title: "SEO 메모", seoTitle: "메모 제목", canonicalUrl: "/memos/canonical" },
			}),
		);
		const repository = repositoryWith(entries);

		const memo = await repository.getMemo("seo-memo");

		expect(memo?.seo).toEqual({ title: "메모 제목", canonicalUrl: "/memos/canonical" });
	});

	it("SEO를 입력하지 않은 글에는 seo 키가 생기지 않는다", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		const post = await repository.getPost("first-post");

		expect(post).not.toBeNull();
		expect(Object.hasOwn(post as object, "seo")).toBe(false);
	});

	it("위험한 canonical은 버리고 나머지 SEO 값은 남긴다", async () => {
		const entries = publishedPostsFixture();
		entries.push(
			record({
				id: "post-bad-canonical",
				collection: "post",
				slug: "bad-canonical-post",
				metadata: { title: "글", categoryId: "cat-1", seoTitle: "제목", canonicalUrl: "javascript:alert(1)" },
			}),
		);
		const repository = repositoryWith(entries);

		const post = await repository.getPost("bad-canonical-post");

		expect(post?.seo).toEqual({ title: "제목" });
	});

	it("NFD로 들어온 한글 주소도 NFC로 정규화해 조회한다", async () => {
		const entries = publishedPostsFixture();
		entries.push(
			record({
				id: "post-hangul",
				collection: "post",
				slug: "한글-슬러그",
				metadata: { title: "한글 글", categoryId: "cat-1" },
			}),
		);
		const repository = repositoryWith(entries);

		// 맥·우분투에서 넘어오는 NFD 주소. Keystatic 저장소와 동일하게 NFC로 맞춰 조회해야 한다.
		const post = await repository.getPost("한글-슬러그".normalize("NFD"));

		expect(post?.slug).toBe("한글-슬러그");
		expect(post?.slug.normalize("NFC")).toBe(post?.slug);
	});

	it("메모 조회도 같은 정규화를 쓴다", async () => {
		const entries = publishedPostsFixture();
		entries.push(
			record({ id: "memo-hangul", collection: "memo", slug: "메모-슬러그", metadata: { title: "한글 메모" } }),
		);
		const repository = repositoryWith(entries);

		const memo = await repository.getMemo("메모-슬러그".normalize("NFD"));

		expect(memo?.slug).toBe("메모-슬러그");
	});

	it("정규화로 찾지 못하면 404로 끝나고 예외를 던지지 않는다", async () => {
		const repository = repositoryWith(publishedPostsFixture());

		await expect(repository.getPost("없는-글".normalize("NFD"))).resolves.toBeNull();
		// 잘못된 퍼센트 인코딩도 500이 아니라 조회 실패로 다룬다.
		await expect(repository.getPost("100%-확실해")).resolves.toBeNull();
	});
});
