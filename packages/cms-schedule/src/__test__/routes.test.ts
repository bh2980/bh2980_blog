import { CmsError } from "@bh2980/cms/plugin/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	createSchedule: vi.fn(),
	cancelSchedule: vi.fn(),
	getEntrySchedule: vi.fn(),
	getDueSchedules: vi.fn(),
	executeSchedulePublish: vi.fn(),
}));

vi.mock("@bh2980/cms/adapters/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("@bh2980/cms/adapters/auth")>()),
	authGateway: { verifyAdmin: () => mocks.verifyAdmin() },
}));

vi.mock("../store", async (importOriginal) => ({
	...(await importOriginal<typeof import("../store")>()),
	createScheduleStore: () => ({
		createSchedule: mocks.createSchedule,
		cancelSchedule: mocks.cancelSchedule,
		getEntrySchedule: mocks.getEntrySchedule,
		getDueSchedules: mocks.getDueSchedules,
		executeSchedulePublish: mocks.executeSchedulePublish,
	}),
}));

import { createCmsRouteHandler } from "@bh2980/cms/testing";
import { scheduleRoutes } from "../routes";

const routes = scheduleRoutes({ tokenEnv: "TEST_SCHEDULER_TOKEN" });
const ORIGIN = "https://example.com";
const entryId = "11111111-1111-4111-8111-111111111111";

function request(method: string, query = "", body?: unknown, headers: Record<string, string> = {}) {
	return new NextRequest(`${ORIGIN}/api/cms/v1/entries/${entryId}/schedule${query}`, {
		method,
		headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

const context = { params: Promise.resolve({ id: entryId }) };

beforeEach(() => {
	for (const mock of Object.values(mocks)) mock.mockReset();
	mocks.verifyAdmin.mockResolvedValue({ userId: "1", accountId: "1", isAdmin: true });
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("예약 API", () => {
	it("예약을 만들고 scheduledAt을 Date로 넘긴다", async () => {
		mocks.createSchedule.mockResolvedValue({ id: "sched-1", status: "pending", scheduledAt: new Date() });
		const response = await routes.entry.POST(
			request("POST", "", { expectedVersion: 3, scheduledAt: "2026-03-02T00:00:00.000Z" }),
			context,
		);
		expect(response.status).toBe(201);
		expect(mocks.createSchedule.mock.calls[0][0]).toMatchObject({ entryId, expectedVersion: 3 });
		expect(mocks.createSchedule.mock.calls[0][0].scheduledAt).toBeInstanceOf(Date);
	});

	it("중복 대기 예약은 409, 판이 없으면 428, 시각이 없거나 틀리면 400이다", async () => {
		mocks.createSchedule.mockRejectedValue(new CmsError("Entry already has a pending schedule", "conflict"));
		const duplicate = await routes.entry.POST(
			request("POST", "", { expectedVersion: 1, scheduledAt: "2026-03-02T00:00:00.000Z" }),
			context,
		);
		expect(duplicate.status).toBe(409);
		mocks.createSchedule.mockReset();

		expect(
			(await routes.entry.POST(request("POST", "", { scheduledAt: "2026-03-02T00:00:00.000Z" }), context)).status,
		).toBe(428);
		expect((await routes.entry.POST(request("POST", "", { expectedVersion: 1 }), context)).status).toBe(400);
		expect(
			(await routes.entry.POST(request("POST", "", { expectedVersion: 1, scheduledAt: "언젠가" }), context)).status,
		).toBe(400);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("세션이 없거나 다른 origin이면 예약을 만들지 않는다", async () => {
		const { AuthError } = await import("@bh2980/cms/plugin/server");
		mocks.verifyAdmin.mockRejectedValueOnce(new AuthError("unauthorized", "Authentication required"));
		const body = { expectedVersion: 1, scheduledAt: "2026-03-02T00:00:00.000Z" };
		expect((await routes.entry.POST(request("POST", "", body), context)).status).toBe(401);
		const cross = await routes.entry.POST(request("POST", "", body, { origin: "https://evil.example.com" }), context);
		expect([400, 403]).toContain(cross.status);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("예약 해제는 200이고, 대기 중인 예약이 없으면 404, scheduleId가 없으면 400이다", async () => {
		mocks.cancelSchedule.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		const ok = await routes.entry.DELETE(request("DELETE", "?scheduleId=sched-1"), context);
		const gone = await routes.entry.DELETE(request("DELETE", "?scheduleId=sched-1"), context);
		const bad = await routes.entry.DELETE(request("DELETE"), context);
		expect(ok.status).toBe(200);
		expect(await ok.json()).toEqual({ id: "sched-1", status: "cancelled" });
		expect(mocks.cancelSchedule).toHaveBeenCalledWith({ scheduleId: "sched-1", entryId });
		expect(gone.status).toBe(404);
		expect(bad.status).toBe(400);
	});

	it("편집 화면 조회는 실행기 연결 여부를 함께 준다", async () => {
		mocks.getEntrySchedule.mockResolvedValue({ pending: null, last: null });
		vi.stubEnv("TEST_SCHEDULER_TOKEN", "");
		expect(await (await routes.entry.GET(request("GET"), context)).json()).toEqual({
			pending: null,
			last: null,
			runnerConfigured: false,
		});
		vi.stubEnv("TEST_SCHEDULER_TOKEN", "token");
		expect((await (await routes.entry.GET(request("GET"), context)).json()).runnerConfigured).toBe(true);
	});

	it("실행기 경로는 설정한 환경 변수의 토큰만 받는다", async () => {
		vi.stubEnv("TEST_SCHEDULER_TOKEN", "runner-token");
		mocks.getDueSchedules.mockResolvedValue([]);
		mocks.executeSchedulePublish.mockResolvedValue({ status: "completed" });
		const runner = (token?: string) =>
			new NextRequest(`${ORIGIN}/api/cms/v1/schedules/due`, {
				headers: token ? { authorization: `Bearer ${token}` } : {},
			});

		expect((await routes.due.GET(runner())).status).toBe(403);
		expect((await routes.due.GET(runner("wrong"))).status).toBe(403);
		expect(await (await routes.due.GET(runner("runner-token"))).json()).toEqual({ schedules: [] });

		const run = await routes.run.POST(runner("runner-token"), { params: Promise.resolve({ id: "sched-1" }) });
		expect(await run.json()).toEqual({ status: "completed" });
		expect(mocks.executeSchedulePublish).toHaveBeenCalledWith({ scheduleId: "sched-1" });
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});

	it("사이트 설정에 넣으면 본체 API 처리기가 예약 경로를 찾는다", async () => {
		vi.stubEnv("TEST_SCHEDULER_TOKEN", "runner-token");
		mocks.getDueSchedules.mockResolvedValue([]);
		const handler = createCmsRouteHandler();
		const call = (path: string, token?: string) =>
			handler.GET(
				new NextRequest(`${ORIGIN}/api/cms/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
				{ params: Promise.resolve({ path: path.split("/") }) },
			);
		expect((await call("v1/schedules/due")).status).toBe(403);
		expect((await call("v1/schedules/due", "runner-token")).status).toBe(200);
	});
});
