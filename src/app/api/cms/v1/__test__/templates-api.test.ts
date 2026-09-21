import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { GET as getTemplates, POST as postTemplate } from "../templates/route";
import {
	DELETE as deleteTemplate,
	GET as getTemplate,
	PATCH as patchTemplate,
} from "../templates/[id]/route";

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

const mockTemplates = [
	{
		id: "t-1",
		name: "알고리즘 풀이",
		forCollection: "memo",
		mdx: "## 문제",
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "t-2",
		name: "포스트 구조",
		forCollection: "post",
		mdx: "## 개요",
		version: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
];

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		listTemplates: vi.fn().mockImplementation(({ forCollection }: { forCollection?: string } = {}) => {
			if (forCollection) {
				return Promise.resolve(mockTemplates.filter((t) => t.forCollection === forCollection));
			}
			return Promise.resolve(mockTemplates);
		}),
		getTemplate: vi.fn().mockImplementation((id: string) => {
			const found = mockTemplates.find((t) => t.id === id);
			if (!found) throw new CmsError("Template not found", "not_found");
			return Promise.resolve(found);
		}),
		createTemplate: vi.fn().mockImplementation((data) => {
			if (data.name === "중복") throw new CmsError("Duplicate name", "conflict");
			return Promise.resolve({
				id: "new-t",
				...data,
				version: 1,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}),
		updateTemplate: vi.fn().mockImplementation((params) => {
			if (params.expectedVersion !== 1) throw new CmsError("Conflict", "conflict", 2);
			return Promise.resolve({
				id: params.id,
				name: params.name || "updated",
				forCollection: "memo",
				mdx: params.mdx || "updated mdx",
				version: 2,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}),
		deleteTemplate: vi.fn().mockImplementation((params) => {
			if (params.expectedVersion !== undefined && params.expectedVersion !== 1) {
				throw new CmsError("Conflict", "conflict", 2);
			}
			return Promise.resolve();
		}),
	}),
}));

const req = (url: string, method = "GET", body?: unknown, origin = "http://localhost") =>
	new NextRequest(url, {
		method,
		headers: {
			origin,
			"content-type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});

describe("M5-BE-2 Templates API Route Contract", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", githubId: "g", isAdmin: true });
	});

	it("GET /templates lists all templates and supports forCollection filter", async () => {
		const allRes = await getTemplates(req("http://localhost/api/cms/v1/templates"));
		expect(allRes.status).toBe(200);
		const allData = await allRes.json();
		expect(allData.items).toHaveLength(2);

		const memoRes = await getTemplates(req("http://localhost/api/cms/v1/templates?forCollection=memo"));
		expect(memoRes.status).toBe(200);
		const memoData = await memoRes.json();
		expect(memoData.items).toHaveLength(1);
		expect(memoData.items[0].name).toBe("알고리즘 풀이");

		const invalidRes = await getTemplates(req("http://localhost/api/cms/v1/templates?forCollection=invalid"));
		expect(invalidRes.status).toBe(400);
	});

	it("POST /templates creates a template and validates body", async () => {
		const res = await postTemplate(
			req("http://localhost/api/cms/v1/templates", "POST", {
				name: "새 템플릿",
				forCollection: "post",
				mdx: "## 내용",
			}),
		);
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.name).toBe("새 템플릿");

		// Reject invalid forCollection
		const invalidRes = await postTemplate(
			req("http://localhost/api/cms/v1/templates", "POST", {
				name: "새 템플릿",
				forCollection: "category",
			}),
		);
		expect(invalidRes.status).toBe(400);

		// Conflict handling (e.g. duplicate name)
		const conflictRes = await postTemplate(
			req("http://localhost/api/cms/v1/templates", "POST", {
				name: "중복",
				forCollection: "post",
			}),
		);
		expect(conflictRes.status).toBe(409);
	});

	it("GET /templates/:id returns single template or 404", async () => {
		const res = await getTemplate(req("http://localhost/api/cms/v1/templates/t-1"), {
			params: Promise.resolve({ id: "t-1" }),
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.name).toBe("알고리즘 풀이");

		const missingRes = await getTemplate(req("http://localhost/api/cms/v1/templates/ghost"), {
			params: Promise.resolve({ id: "ghost" }),
		});
		expect(missingRes.status).toBe(404);
	});

	it("PATCH /templates/:id updates template and checks expectedVersion", async () => {
		const res = await patchTemplate(
			req("http://localhost/api/cms/v1/templates/t-1", "PATCH", {
				expectedVersion: 1,
				name: "수정된 템플릿",
			}),
			{ params: Promise.resolve({ id: "t-1" }) },
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.version).toBe(2);

		// Conflict on stale expectedVersion
		const conflictRes = await patchTemplate(
			req("http://localhost/api/cms/v1/templates/t-1", "PATCH", {
				expectedVersion: 99,
				name: "충돌 테스트",
			}),
			{ params: Promise.resolve({ id: "t-1" }) },
		);
		expect(conflictRes.status).toBe(409);
	});

	it("DELETE /templates/:id deletes template with optional expectedVersion", async () => {
		const res = await deleteTemplate(req("http://localhost/api/cms/v1/templates/t-1?expectedVersion=1", "DELETE"), {
			params: Promise.resolve({ id: "t-1" }),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		// Conflict on stale expectedVersion
		const conflictRes = await deleteTemplate(
			req("http://localhost/api/cms/v1/templates/t-1?expectedVersion=99", "DELETE"),
			{ params: Promise.resolve({ id: "t-1" }) },
		);
		expect(conflictRes.status).toBe(409);
	});
});
