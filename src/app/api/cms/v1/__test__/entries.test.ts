import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { GET as getMeta } from "../meta/route";
import { GET as getEntries, POST as postEntries } from "../entries/route";
import { GET as getEntry, PATCH as patchEntry } from "../entries/[id]/route";

vi.mock("@/cms/adapters/auth", () => ({
	authGateway: {
		verifyAdmin: vi.fn().mockResolvedValue({ userId: "123", githubId: "123", isAdmin: true }),
	},
	AuthError: class AuthError extends Error {
		constructor(public code: string, message: string) {
			super(message);
		}
	},
}));

vi.mock("@/cms/container", () => {
	const mockStore = {
		listEntries: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
		getEntry: vi.fn().mockImplementation((id: string) => {
			if (id === "non-existent") {
				throw new CmsError("Not found", "not_found");
			}
			return Promise.resolve({
				id,
				collection: "post",
				version: 1,
				workingSlug: "my-post",
				working: { metadata: { title: "Title" }, mdx: "Hello", schemaVersion: 1 },
			});
		}),
		moveEntryToFolder: vi.fn().mockResolvedValue(undefined),
	};

	const mockService = {
		createDraft: vi.fn().mockImplementation((input) => {
			return Promise.resolve({
				id: "new-entry-id",
				collection: input.collection,
				version: 1,
				workingSlug: input.slug,
			});
		}),
		saveDraft: vi.fn().mockImplementation((id, input) => {
			if (input.expectedVersion === 1) {
				throw new CmsError("Conflict", "conflict", 2);
			}
			if (input.slug === "existing-slug") {
				throw new CmsError("Slug conflict", "slug_conflict");
			}
			return Promise.resolve({
				id,
				collection: input.collection,
				version: input.expectedVersion + 1,
				workingSlug: input.slug,
			});
		}),
	};

	return {
		getCmsContentStore: () => mockStore,
		getCmsContentService: () => mockService,
	};
});

describe("M2-BE-3 HTTP API Contract", () => {
	it("GET /meta returns metadata for authorized admin", async () => {
		const res = await getMeta();
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.collections).toContain("post");
		expect(data.version).toBe("v1");
	});

	it("GET /entries requires valid collection and validates query parameters", async () => {
		const reqWithoutCol = new NextRequest("http://localhost/api/cms/v1/entries");
		const resWithoutCol = await getEntries(reqWithoutCol);
		expect(resWithoutCol.status).toBe(400);

		const reqWithCol = new NextRequest("http://localhost/api/cms/v1/entries?collection=post&pageSize=25");
		const resWithCol = await getEntries(reqWithCol);
		expect(resWithCol.status).toBe(200);
		const data = await resWithCol.json();
		expect(data.pageSize).toBe(25);
	});

	it("POST /entries creates a new draft", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries", {
			method: "POST",
			body: JSON.stringify({
				collection: "post",
				slug: "test-slug",
				metadata: { title: "Test Post" },
				mdx: "# Test Content",
			}),
		});

		const res = await postEntries(req);
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe("new-entry-id");
	});

	it("GET /entries/:id returns entry or 404", async () => {
		const foundReq = new NextRequest("http://localhost/api/cms/v1/entries/existing-id");
		const foundRes = await getEntry(foundReq, { params: Promise.resolve({ id: "existing-id" }) });
		expect(foundRes.status).toBe(200);

		const missingReq = new NextRequest("http://localhost/api/cms/v1/entries/non-existent");
		const missingRes = await getEntry(missingReq, { params: Promise.resolve({ id: "non-existent" }) });
		expect(missingRes.status).toBe(404);
	});

	it("PATCH /entries/:id rejects without version with 428 version_required", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/test-id", {
			method: "PATCH",
			body: JSON.stringify({
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }) });
		expect(res.status).toBe(428);
		const data = await res.json();
		expect(data.code).toBe("version_required");
	});

	it("PATCH /entries/:id maps optimistic lock conflict to 409 and returns serverVersion", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/test-id", {
			method: "PATCH",
			body: JSON.stringify({
				expectedVersion: 1, // trigger mock conflict
				metadata: { title: "Updated" },
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }) });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.code).toBe("conflict");
		expect(data.serverVersion).toBe(2);
	});

	it("PATCH /entries/:id maps slug conflict to 409 slug_conflict", async () => {
		const req = new NextRequest("http://localhost/api/cms/v1/entries/test-id", {
			method: "PATCH",
			body: JSON.stringify({
				expectedVersion: 5,
				slug: "existing-slug",
			}),
		});

		const res = await patchEntry(req, { params: Promise.resolve({ id: "test-id" }) });
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.code).toBe("slug_conflict");
	});
});
