import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postRun } from "../routes/run/route";

const mockVerifyAdmin = vi.fn();
const overrides = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: unknown; version: number }> }));

vi.mock("@bh2980/cms/adapters/auth", () => ({
	authGateway: { verifyAdmin: () => mockVerifyAdmin() },
	AuthError: class AuthError extends Error {
		constructor(
			public code: string,
			message: string,
		) {
			super(message);
		}
	},
}));

vi.mock("../store", () => ({
	getAiStore: () => ({
		listAiActionOverrides: async () => overrides.rows.map((row) => ({ ...row, updatedAt: new Date(0) })),
		getAiSettings: async () => null,
		findTakenSlugs: async () => new Set(),
	}),
}));

vi.mock("@bh2980/cms/container", () => ({
	getCmsContentStore: () => ({
		listEntries: async () => ({ items: [], total: 0 }),
		getMediaAsset: async () => null,
	}),
	getCmsMediaStore: () => ({}),
}));

const run = (body: unknown) =>
	postRun(
		new NextRequest("http://localhost/api/cms/v1/ai/run", {
			method: "POST",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

describe("AI 실행 API", () => {
	beforeEach(() => {
		mockVerifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
		vi.stubEnv("CMS_AI_FAKE", "1");
		overrides.rows = [];
	});
	afterEach(() => vi.unstubAllEnvs());

	it("기능을 이름과 입력으로 실행한다", async () => {
		const res = await run({
			action: "summary",
			input: { title: "React 훅", body: "본문" },
			env: { collection: "post" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ result: { kind: "text", text: "(fake) React 훅" } });
	});

	it("여러 입력은 입력마다 결과나 실패 이유를 순서대로 돌려준다", async () => {
		const res = await run({
			action: "translate",
			inputs: [
				{ block: "안녕 **세계**", from: "ko", to: "en" },
				{ block: "", from: "ko", to: "en" },
			],
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			results: [{ result: { kind: "mdx", text: "안녕 **세계**" } }, { error: "원문이 없습니다." }],
		});
	});

	it("없는 기능·정의에 맞지 않는 입력·꺼진 기능·잘못된 시험 값은 막는다", async () => {
		expect((await run({ action: "nope", input: {} })).status).toBe(404);
		expect((await run({ action: "translate", input: { block: 1, from: "ko", to: "en" } })).status).toBe(400);
		expect((await run({ action: "summary", input: {}, inputs: [{}] })).status).toBe(400);

		overrides.rows = [{ key: "summary", value: { enabled: false }, version: 1 }];
		expect((await run({ action: "summary", input: { title: "t" } })).status).toBe(503);
		// 시험은 꺼진 기능도 저장하지 않은 값으로 돌린다. 지시문에 언어 입력이 아닌 자리 표시는 받지 않는다.
		expect((await run({ action: "summary", input: { title: "t" }, draft: { enabled: false } })).status).toBe(200);
		const bad = await run({ action: "summary", input: { title: "t" }, draft: { prompt: "{{title}}" } });
		expect(bad.status).toBe(400);
		expect(await bad.json()).toMatchObject({ code: "ai_invalid_input" });
	});
});
