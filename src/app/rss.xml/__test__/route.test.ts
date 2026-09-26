import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ listPosts: vi.fn() }));
vi.mock("@/libs/contents/services/post", () => ({ listPosts: repo.listPosts }));

import { GET } from "../route";

describe("RSS public isolation", () => {
	let previousHostUrl: string | undefined;

	beforeEach(() => {
		previousHostUrl = process.env.HOST_URL;
		process.env.HOST_URL = "https://example.com";
	});

	afterEach(() => {
		if (previousHostUrl === undefined) Reflect.deleteProperty(process.env, "HOST_URL");
		else process.env.HOST_URL = previousHostUrl;
		vi.clearAllMocks();
	});

	it("excludes a working draft even if an upstream list contains one", async () => {
		repo.listPosts.mockResolvedValue({
			list: [
				{
					slug: "public-entry",
					status: "published",
					publishedAt: "2026-03-01T12:00:00.000Z",
					title: "공개 제목",
					excerpt: "공개 요약",
				},
				{
					slug: "draft-private",
					status: "draft",
					publishedAt: "2026-03-02T12:00:00.000Z",
					title: "초안 비밀",
					excerpt: "초안 요약",
				},
				{ slug: "archived-private", status: "archived", publishedAt: "2026-03-03", title: "보관 비밀" },
				{ slug: "trash-private", status: "trash", publishedAt: "2026-03-04", title: "휴지통 비밀" },
			],
			total: 2,
		});

		const response = await GET();
		const xml = await response.text();

		expect(response.status).toBe(200);
		expect(xml).toContain("public-entry");
		expect(xml).not.toContain("draft-private");
		expect(xml).not.toContain("초안 비밀");
		expect(xml).not.toContain("archived-private");
		expect(xml).not.toContain("trash-private");
		expect(xml).not.toContain("보관 비밀");
		expect(xml).not.toContain("휴지통 비밀");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});
