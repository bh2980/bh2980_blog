import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { POST as postBulk } from "../bulk/route";

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

const CAT_1 = "11111111-1111-4111-8111-111111111111";
const TAG_1 = "33333333-3333-4333-8333-333333333333";
const TAG_2 = "44444444-4444-4444-8444-444444444444";

const working = (version: number) => ({
	collection: "post",
	slug: "hello",
	metadata: { title: "Hello", categoryId: CAT_1, tagIds: [TAG_1] },
	mdx: "body",
	version,
	folderId: null,
});

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		getWorkingReferences: vi.fn().mockResolvedValue([]),
		getWorking: vi.fn().mockImplementation(({ entryId }: { entryId: string }) => {
			if (entryId === "missing") throw new CmsError("Entry not found", "not_found");
			return Promise.resolve(working(3));
		}),
		saveWorkingWithReferences: vi.fn().mockImplementation(({ entryId, expectedVersion }) => {
			if (expectedVersion !== 3) throw new CmsError("Conflict", "conflict", 9);
			return Promise.resolve({ version: 4, id: entryId });
		}),
	}),
}));

const postReq = (body: unknown) =>
	new NextRequest("http://localhost/api/cms/v1/bulk", {
		method: "POST",
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("M4-BE-1a Bulk route contract", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", githubId: "g", isAdmin: true });
	});

	it("returns per-item results with partial success", async () => {
		const res = await postBulk(
			postReq({
				op: "tags.add",
				items: [
					{ id: "e1", expectedVersion: 3 },
					{ id: "stale", expectedVersion: 2 },
					{ id: "missing", expectedVersion: 1 },
				],
				tagIds: [TAG_2],
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			results: [
				{ id: "e1", ok: true, version: 4 },
				{ id: "stale", ok: false, error: "conflict" },
				{ id: "missing", ok: false, error: "not_found" },
			],
		});
	});

	it("rejects more than 100 items with 400", async () => {
		const res = await postBulk(
			postReq({
				op: "tags.add",
				items: Array.from({ length: 101 }, (_, i) => ({ id: `e-${i}`, expectedVersion: 1 })),
				tagIds: [TAG_1],
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects unknown op with 400", async () => {
		const res = await postBulk(postReq({ op: "nope", items: [] }));
		expect(res.status).toBe(400);
	});
});
