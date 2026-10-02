import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { CMS_ROUTE_PATTERNS, createCmsRouteHandler, matchRoute } from "../router";

vi.mock("../../adapters/auth", () => ({
	authGateway: { verifyAdmin: async () => ({ userId: "u", githubId: "g", isAdmin: true }) },
	AuthError: class AuthError extends Error {},
}));

vi.mock("../../container", () => ({
	getCmsContentStore: () => ({ getPreferences: async () => null }),
}));

describe("관리자 API 경로표", () => {
	it("이름 있는 조각이 [이름] 조각보다 먼저 맞고, 매개변수를 꺼낸다", () => {
		expect(matchRoute(["v1", "entries"])?.params).toEqual({});
		expect(matchRoute(["v1", "entries", "abc"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "entries", "abc", "publish"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "media", "uploads"])?.params).toEqual({});
		expect(matchRoute(["v1", "media", "m1", "complete"])?.params).toEqual({ id: "m1" });
		expect(matchRoute(["v1", "schedules", "due"])?.params).toEqual({});
		expect(matchRoute(["v1", "ai", "actions", "summary", "reset"])?.params).toEqual({ key: "summary" });
		expect(matchRoute(["v1", "entries", ""])).toBeNull();
		expect(matchRoute(["v1", "nope"])).toBeNull();
		expect(matchRoute(["v2", "entries"])).toBeNull();
	});

	it("공개 API는 본체 경로표에 없다(블로그가 가진다)", () => {
		expect(CMS_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("v1/public"))).toBe(false);
		expect(CMS_ROUTE_PATTERNS).toHaveLength(35);
	});

	it("없는 경로는 404, 없는 메서드는 405, 맞는 경로는 그 라우트가 받는다", async () => {
		const handler = createCmsRouteHandler();
		const call = (method: "GET" | "DELETE", path: string) =>
			handler[method](
				new NextRequest(`http://localhost/api/cms/${path}`, { method, headers: { origin: "http://localhost" } }),
				{ params: Promise.resolve({ path: path.split("/") }) },
			);
		expect((await call("GET", "v1/nope")).status).toBe(404);
		expect((await call("DELETE", "v1/preferences")).status).toBe(405);
		expect((await call("GET", "v1/preferences")).status).toBe(200);
	});
});
