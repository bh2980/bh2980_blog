import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPreferences, PUT as putPreferences } from "../route";

vi.mock("@/cms/adapters/auth", () => ({
	authGateway: {
		verifyAdmin: vi.fn().mockResolvedValue({ userId: "user-42", githubId: "user-42", isAdmin: true }),
	},
	AuthError: class AuthError extends Error {
		constructor(public code: string, message: string) {
			super(message);
		}
	},
}));

vi.mock("@/cms/container", () => {
	let storedPrefs: any = null;
	const mockStore = {
		getPreferences: vi.fn().mockImplementation(() => Promise.resolve(storedPrefs)),
		savePreferences: vi.fn().mockImplementation((params) => {
			storedPrefs = params.preferences;
			return Promise.resolve();
		}),
	};

	return {
		getCmsContentStore: () => mockStore,
	};
});

describe("M2-BE-5 Preferences API Contract", () => {
	it("GET and PUT /preferences saves and retrieves user preferences", async () => {
		const getRes1 = await getPreferences();
		expect(getRes1.status).toBe(200);
		const initial = await getRes1.json();
		expect(initial).toEqual({});

		const putReq = new NextRequest("http://localhost/api/cms/v1/preferences", {
			method: "PUT",
			body: JSON.stringify({
				defaultPageSize: 50,
				sort: { field: "title", direction: "asc" },
			}),
		});
		const putRes = await putPreferences(putReq);
		expect(putRes.status).toBe(200);

		const getRes2 = await getPreferences();
		const saved = await getRes2.json();
		expect(saved.defaultPageSize).toBe(50);
		expect(saved.sort).toEqual({ field: "title", direction: "asc" });
	});

	it("PUT /preferences rejects invalid pageSize with 400", async () => {
		const putReq = new NextRequest("http://localhost/api/cms/v1/preferences", {
			method: "PUT",
			body: JSON.stringify({
				defaultPageSize: 30, // invalid: must be 25, 50, 100
			}),
		});
		const putRes = await putPreferences(putReq);
		expect(putRes.status).toBe(400);
	});
});
