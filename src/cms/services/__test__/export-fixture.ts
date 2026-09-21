import type { ExportSnapshot } from "@/cms/adapters/postgres/content-store";

export const FIXTURE_TIME = new Date("2026-09-22T00:00:00.000Z");

export const fixtureBody = (mdx: string, title: string, contentHash: string) => ({
	metadata: { title },
	mdx,
	schemaVersion: 1,
	contentHash,
	updatedAt: FIXTURE_TIME,
});

/** 내보내기 테스트 공용 스냅샷: 공개 글 1건 + 초안 1건. */
export const makeExportFixtureSnapshot = (): ExportSnapshot => ({
	entries: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			collection: "post",
			status: "published",
			version: 3,
			folderId: null,
			workingSlug: "published-post",
			publishedSlug: "published-post",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			firstPublishedAt: null,
			lastPublishedAt: null,
			publishedAt: FIXTURE_TIME,
			working: fixtureBody("working body", "게시글", "hash-working-1"),
			published: fixtureBody("published body", "게시글", "hash-published-1"),
		},
		{
			id: "22222222-2222-4222-8222-222222222222",
			collection: "memo",
			status: "draft",
			version: 1,
			folderId: null,
			workingSlug: "draft-memo",
			publishedSlug: null,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			firstPublishedAt: null,
			lastPublishedAt: null,
			publishedAt: null,
			working: fixtureBody("draft secret body", "메모", "hash-working-2"),
		},
	],
	references: [
		{
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "working",
			kind: "tag",
			targetId: "33333333-3333-4333-8333-333333333333",
			isStale: false,
			occurrences: [{ type: "metadata", path: "tagIds", ordinal: 0 }],
		},
		{
			entryId: "22222222-2222-4222-8222-222222222222",
			state: "working",
			kind: "media",
			targetId: "44444444-4444-4444-8444-444444444444",
			isStale: false,
			occurrences: [{ type: "mdx", line: 3, column: 1 }],
		},
	],
	folders: [
		{
			id: "55555555-5555-4555-8555-555555555555",
			collection: "post",
			parentId: null,
			name: "루트",
			position: 0,
			version: 1,
		},
	],
	addresses: [{ collection: "post", slug: "old-slug", entryId: "11111111-1111-4111-8111-111111111111", type: "alias" }],
	media: [
		{
			id: "44444444-4444-4444-8444-444444444444",
			status: "ready",
			filename: "draft-only.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
			stagingKey: null,
			storageKey: "media/draft-only.png",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			readyAt: FIXTURE_TIME,
		},
	],
	templates: [
		{
			id: "66666666-6666-4666-8666-666666666666",
			name: "기본",
			forCollection: "post",
			mdx: "## 문제",
			version: 1,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
		},
	],
	schedules: [
		{
			id: "77777777-7777-4777-8777-777777777777",
			entryId: "22222222-2222-4222-8222-222222222222",
			scheduledAt: FIXTURE_TIME,
			status: "pending",
			createdAt: FIXTURE_TIME,
			completedAt: null,
			failureCode: null,
			failureDetail: null,
		},
	],
	preferences: [{ userId: "admin", preferences: { defaultPageSize: 25 }, updatedAt: FIXTURE_TIME }],
});
