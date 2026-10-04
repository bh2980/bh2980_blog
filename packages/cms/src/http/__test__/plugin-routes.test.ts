import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	privateGet: vi.fn(async () => new Response("private")),
	publicPost: vi.fn(async () => new Response("public")),
}));

vi.mock("../../adapters/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../adapters/auth")>()),
	authGateway: { verifyAdmin: () => mocks.verifyAdmin() },
}));

vi.mock("../../plugin/server", () => ({
	pluginRoutes: async () => [
		{ pattern: "v1/example/private", module: { GET: mocks.privateGet, POST: mocks.privateGet } },
		{ pattern: "v1/example/hook", module: { POST: mocks.publicPost }, public: true },
	],
}));

import { AuthError } from "../../adapters/auth";
import { createCmsRouteHandler } from "../router";

const ORIGIN = "http://localhost";
const call = (method: "GET" | "POST", path: string, headers: Record<string, string> = {}) =>
	createCmsRouteHandler()[method](
		new NextRequest(`${ORIGIN}/api/cms/${path}`, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(method === "POST" ? { body: "{}" } : {}),
		}),
		{ params: Promise.resolve({ path: path.split("/") }) },
	);

beforeEach(() => {
	vi.clearAllMocks();
	mocks.verifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
});

describe("플러그인 API 경로 기본 인증(M13-1)", () => {
	it("로그인하지 않았으면 플러그인 경로를 부르지 않고 401이다", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect((await call("GET", "v1/example/private")).status).toBe(401);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("다른 출처의 변경 요청은 로그인 확인 전에 거부한다", async () => {
		const response = await call("POST", "v1/example/private", { origin: "https://evil.example.com" });
		expect(response.status).toBe(403);
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("관리자면 플러그인 경로가 받는다", async () => {
		expect(await (await call("POST", "v1/example/private", { origin: ORIGIN })).text()).toBe("private");
		expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1);
	});

	it("`public: true` 경로는 감싸지 않는다(경로가 스스로 확인한다)", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect(await (await call("POST", "v1/example/hook")).text()).toBe("public");
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});
});
