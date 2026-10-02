import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getPreferences, PUT as putPreferences } from "../route";

vi.mock("@bh2980/cms/adapters/auth", () => ({
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

vi.mock("@bh2980/cms/container", () => ({
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

	it("rejects malformed column names, duplicate order entries and invalid page sizes with 400", async () => {
		for (const body of [
			{ collections: { post: { columns: { order: ["title", "title"] } } } },
			{ collections: { post: { columns: { visibility: { "not a column": true } } } } },
			{ collections: { post: { columns: { order: ["title", "1st"] } } } },
			{ collections: { post: { pageSize: 30 } } },
			{ collections: { unknown: { pageSize: 25 } } },
		]) {
			const res = await putPreferences(putReq(body));
			expect(res.status).toBe(400);
		}
	});
});
