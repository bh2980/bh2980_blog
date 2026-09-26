import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getPreferences, PUT as putPreferences } from "../route";

vi.mock("@/cms/adapters/auth", () => ({
	authGateway: {
		verifyAdmin: vi.fn().mockResolvedValue({ userId: "user-42", githubId: "user-42", isAdmin: true }),
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

const state = vi.hoisted(() => ({ stored: null as unknown }));

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		getPreferences: vi.fn().mockImplementation(() => Promise.resolve(state.stored)),
		savePreferences: vi.fn().mockImplementation((params: { preferences: unknown }) => {
			state.stored = params.preferences;
			return Promise.resolve();
		}),
	}),
}));

const getReq = () => new NextRequest("http://localhost/api/cms/v1/preferences");
const putReq = (body: unknown) =>
	new NextRequest("http://localhost/api/cms/v1/preferences", {
		method: "PUT",
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("Preferences API — 컬렉션별 목록 설정(§3.2)", () => {
	beforeEach(() => {
		state.stored = null;
	});

	it("stores page size, sort and columns per collection and merges partial updates", async () => {
		const initial = await (await getPreferences(getReq())).json();
		expect(initial.collections.post).toEqual({});

		const res = await putPreferences(
			putReq({ collections: { post: { pageSize: 50, sort: { field: "publishedAt", direction: "asc" } } } }),
		);
		expect(res.status).toBe(200);
		await putPreferences(
			putReq({ collections: { post: { columns: { order: ["title", "category"], visibility: { slug: true } } } } }),
		);
		await putPreferences(putReq({ collections: { memo: { pageSize: 100 } } }));

		const saved = await (await getPreferences(getReq())).json();
		expect(saved.collections.post).toEqual({
			pageSize: 50,
			sort: { field: "publishedAt", direction: "asc" },
			columns: { order: ["title", "category"], visibility: { slug: true } },
		});
		expect(saved.collections.memo).toEqual({ pageSize: 100 });
	});

	it("reads the previous global shape as per-collection settings", async () => {
		state.stored = {
			defaultPageSize: 50,
			sort: { field: "title", direction: "asc" },
			columnSettings: { memo: { visibility: { tags: false } } },
		};
		const saved = await (await getPreferences(getReq())).json();
		expect(saved.collections.memo).toEqual({
			pageSize: 50,
			sort: { field: "title", direction: "asc" },
			columns: { visibility: { tags: false } },
		});
		expect(saved.collections.post).toEqual({ pageSize: 50, sort: { field: "title", direction: "asc" } });
	});

	it("rejects unknown columns, duplicate order entries and invalid page sizes with 400", async () => {
		for (const body of [
			{ collections: { post: { columns: { order: ["title", "title"] } } } },
			{ collections: { post: { columns: { visibility: { nope: true } } } } },
			{ collections: { post: { pageSize: 30 } } },
			{ collections: { unknown: { pageSize: 25 } } },
		]) {
			const res = await putPreferences(putReq(body));
			expect(res.status).toBe(400);
		}
	});

	it("replaces saved views as a whole per collection and keeps the other settings (v2 A4)", async () => {
		await putPreferences(putReq({ collections: { post: { pageSize: 50 } } }));
		const views = [
			{ id: "v1", name: "수정 중인 글", query: "changes=1", columns: { visibility: { slug: true } } },
			{ id: "v2", name: "초안", query: "status=draft" },
		];
		expect((await putPreferences(putReq({ collections: { post: { views } } }))).status).toBe(200);
		expect((await putPreferences(putReq({ collections: { post: { views: [views[1]] } } }))).status).toBe(200);

		const saved = await (await getPreferences(getReq())).json();
		expect(saved.collections.post).toEqual({ pageSize: 50, views: [views[1]] });
	});

	it("rejects duplicate view ids, blank names and too many views with 400", async () => {
		const view = (id: string) => ({ id, name: `보기 ${id}`, query: "" });
		for (const body of [
			{ collections: { post: { views: [view("a"), view("a")] } } },
			{ collections: { post: { views: [{ id: "a", name: "  ", query: "" }] } } },
			{ collections: { post: { views: Array.from({ length: 21 }, (_, index) => view(String(index))) } } },
		]) {
			const res = await putPreferences(putReq(body));
			expect(res.status).toBe(400);
		}
	});
});
