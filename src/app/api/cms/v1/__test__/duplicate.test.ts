import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { POST as postDuplicate } from "../entries/[id]/duplicate/route";

const mockVerifyAdmin = vi.fn();

vi.mock("@/cms/adapters/auth", () => ({
	authGateway: {
		verifyAdmin: () => mockVerifyAdmin(),
	},
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		duplicateEntry: vi.fn().mockImplementation(({ id }: { id: string }) => {
			if (id === "ghost") throw new CmsError("Entry not found", "not_found");
			return Promise.resolve({
				id: "new-duplicated-id",
				collection: "post",
				version: 1,
				status: "draft",
				workingSlug: null,
				folderId: "folder-1",
				working: {
					metadata: { title: "Original (복사)" },
					mdx: "body",
					schemaVersion: 1,
				},
			});
		}),
	}),
}));

const postReq = (url: string, origin = "http://localhost") =>
	new NextRequest(url, {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
		},
	});

describe("M5-BE-1 Duplicate API Route", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", githubId: "g", isAdmin: true });
	});

	it("duplicates entry with 201 Created", async () => {
		const res = await postDuplicate(postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate"), {
			params: Promise.resolve({ id: "orig-1" }),
		});
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe("new-duplicated-id");
		expect(data.status).toBe("draft");
		expect(data.working.metadata.title).toBe("Original (복사)");
	});

	it("returns 404 when entry does not exist", async () => {
		const res = await postDuplicate(postReq("http://localhost/api/cms/v1/entries/ghost/duplicate"), {
			params: Promise.resolve({ id: "ghost" }),
		});
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.code).toBe("not_found");
	});

	it("rejects cross-origin requests with 403", async () => {
		const res = await postDuplicate(postReq("http://localhost/api/cms/v1/entries/orig-1/duplicate", "http://evil.com"), {
			params: Promise.resolve({ id: "orig-1" }),
		});
		expect(res.status).toBe(403);
	});
});
