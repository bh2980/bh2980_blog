import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/cms/adapters/auth";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { ServiceError } from "@/cms/services/types";
import { POST } from "../route";

const { verifyAdmin, getWorking, publishEntry, imageWarningsForPublish } = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	getWorking: vi.fn(),
	publishEntry: vi.fn(),
	imageWarningsForPublish: vi.fn(),
}));

vi.mock("@/cms/adapters/auth", () => ({
	authGateway: { verifyAdmin },
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
	getCmsContentStore: () => ({ getWorking, publishEntry, getMediaAsset: vi.fn() }),
	getCmsMediaStore: () => ({ headFile: vi.fn() }),
}));
vi.mock("@/cms/services/content-service", () => ({ imageWarningsForPublish }));

function request(body: unknown = { expectedVersion: 4 }, origin = "http://localhost") {
	return new NextRequest("http://localhost/api/cms/v1/entries/entry-1/publish", {
		method: "POST",
		headers: { origin, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

const context = { params: Promise.resolve({ id: "entry-1" }) };

describe("M10 publish HTTP contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyAdmin.mockResolvedValue({ isAdmin: true });
		getWorking.mockResolvedValue({ collection: "post", slug: "entry-1", metadata: { title: "Title" }, mdx: "Body" });
		publishEntry.mockResolvedValue({ id: "entry-1", version: 5, status: "published" });
		imageWarningsForPublish.mockResolvedValue([]);
	});

	it("returns warnings with a successful committed publish", async () => {
		const warnings = [{ code: "image_media_not_ready", position: { line: 3, column: 2 } }];
		imageWarningsForPublish.mockResolvedValue(warnings);
		const response = await POST(request(), context);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ status: "published", warnings });
		expect(publishEntry).toHaveBeenCalledWith({ id: "entry-1", expectedVersion: 4, publishedAt: undefined });
	});

	it("does not publish when validation fails", async () => {
		const issues = [{ code: "missing_title", path: "title" }];
		publishEntry.mockRejectedValue(new ServiceError("publish_validation_failed", issues));
		const response = await POST(request(), context);
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({ code: "publish_validation_failed", issues });
	});

	it("keeps optimistic version conflicts", async () => {
		publishEntry.mockRejectedValue(new CmsError("Conflict", "conflict", 7));
		const response = await POST(request(), context);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ code: "conflict", serverVersion: 7 });
	});

	it("requires expectedVersion before any publish", async () => {
		const response = await POST(request({}), context);
		expect(response.status).toBe(428);
		expect(publishEntry).not.toHaveBeenCalled();
	});

	it("blocks unauthorized and cross-origin requests before reads and writes", async () => {
		verifyAdmin.mockRejectedValueOnce(new AuthError("unauthorized", "Not logged in"));
		const unauthorized = await POST(request(), context);
		expect(unauthorized.status).toBe(401);
		const crossOrigin = await POST(request({ expectedVersion: 4 }, "http://attacker.invalid"), context);
		expect(crossOrigin.status).toBe(403);
		expect(getWorking).not.toHaveBeenCalled();
		expect(publishEntry).not.toHaveBeenCalled();
	});
});
