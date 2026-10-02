import { createCmsRouteHandler } from "@bh2980/cms/http/router";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import aiServer from "../server";

vi.mock("@bh2980/cms/adapters/auth", () => ({
	authGateway: { verifyAdmin: async () => ({ userId: "u", accountId: "g", isAdmin: true }) },
	AuthError: class AuthError extends Error {},
}));

vi.mock("../store", () => ({
	getAiStore: () => ({ getAiSettings: async () => null, listAiActionOverrides: async () => [] }),
}));

describe("AI 플러그인 등록", () => {
	it("서버 쪽이 AI API 경로·표 만들기·메타 표시를 준다", async () => {
		expect(aiServer.routes?.map((route) => route.pattern)).toContain("v1/ai/run");
		expect(aiServer.migrate).toBeTypeOf("function");
		expect(await aiServer.features?.()).toEqual({ ai: false });
	});

	it("본체 API 처리기가 본체 경로에 없는 주소를 플러그인 경로표에서 찾는다", async () => {
		const handler = createCmsRouteHandler();
		const call = (path: string) =>
			handler.GET(new NextRequest(`http://localhost/api/cms/${path}`, { headers: { origin: "http://localhost" } }), {
				params: Promise.resolve({ path: path.split("/") }),
			});
		const actions = await call("v1/ai/actions");
		expect(actions.status).toBe(200);
		expect(((await actions.json()) as { items: { key: string }[] }).items.map((item) => item.key)).toContain("summary");
		expect((await call("v1/ai/nope")).status).toBe(404);
	});
});
