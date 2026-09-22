import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsError } from "@/cms/adapters/postgres/content-store";

const mocks = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	createSchedule: vi.fn(),
	cancelSchedule: vi.fn(),
}));

vi.mock("@/cms/adapters/auth", () => ({
	AuthError: class AuthError extends Error {
		constructor(
			public readonly code: "unauthorized" | "forbidden",
			message: string,
		) {
			super(message);
		}
	},
	authGateway: { verifyAdmin: () => mocks.verifyAdmin() },
}));

vi.mock("@/cms/container", () => ({
	getCmsContentStore: () => ({
		createSchedule: mocks.createSchedule,
		cancelSchedule: mocks.cancelSchedule,
	}),
}));

import { DELETE, POST } from "../route";

const ORIGIN = "https://example.com";
const entryId = "11111111-1111-4111-8111-111111111111";

function request(method: string, query = "", body?: unknown) {
	return new NextRequest(`${ORIGIN}/api/cms/v1/entries/${entryId}/schedule${query}`, {
		method,
		headers: {
			origin: ORIGIN,
			"content-type": "application/json",
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

const context = { params: Promise.resolve({ id: entryId }) };

beforeEach(() => {
	mocks.verifyAdmin.mockReset();
	mocks.verifyAdmin.mockResolvedValue({ userId: "1", githubId: "1", isAdmin: true });
	mocks.createSchedule.mockReset();
	mocks.cancelSchedule.mockReset();
});

describe("M7-TW-1 예약 API 회귀", () => {
	it("예약을 만들고 scheduledAt을 Date로 넘긴다", async () => {
		mocks.createSchedule.mockResolvedValue({ id: "sched-1", status: "pending", scheduledAt: new Date() });

		const response = await POST(
			request("POST", "", { expectedVersion: 3, scheduledAt: "2026-03-02T00:00:00.000Z" }),
			context,
		);

		expect(response.status).toBe(200);
		expect(mocks.createSchedule).toHaveBeenCalledTimes(1);
		expect(mocks.createSchedule.mock.calls[0][0]).toMatchObject({ entryId, expectedVersion: 3 });
		expect(mocks.createSchedule.mock.calls[0][0].scheduledAt).toBeInstanceOf(Date);
	});

	it("중복 pending 예약은 500이 아니라 409다", async () => {
		mocks.createSchedule.mockRejectedValue(new CmsError("Entry already has a pending schedule", "conflict"));

		const response = await POST(
			request("POST", "", { expectedVersion: 1, scheduledAt: "2026-03-02T00:00:00.000Z" }),
			context,
		);
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.code).toBe("conflict");
	});

	it("expectedVersion이 없으면 428이고 저장소를 건드리지 않는다", async () => {
		const response = await POST(request("POST", "", { scheduledAt: "2026-03-02T00:00:00.000Z" }), context);

		expect(response.status).toBe(428);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("scheduledAt이 없거나 해석 불가면 400이다", async () => {
		const missing = await POST(request("POST", "", { expectedVersion: 1 }), context);
		const invalid = await POST(request("POST", "", { expectedVersion: 1, scheduledAt: "언젠가" }), context);

		expect(missing.status).toBe(400);
		expect(invalid.status).toBe(400);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("세션이 없으면 401이고 예약을 만들지 않는다", async () => {
		const { AuthError } = await import("@/cms/adapters/auth");
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));

		const response = await POST(
			request("POST", "", { expectedVersion: 1, scheduledAt: "2026-03-02T00:00:00.000Z" }),
			context,
		);

		expect(response.status).toBe(401);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("다른 origin에서 온 요청은 거부하고 예약을 만들지 않는다", async () => {
		const crossOrigin = new NextRequest(`${ORIGIN}/api/cms/v1/entries/${entryId}/schedule`, {
			method: "POST",
			headers: { origin: "https://evil.example.com", "content-type": "application/json" },
			body: JSON.stringify({ expectedVersion: 1, scheduledAt: "2026-03-02T00:00:00.000Z" }),
		});

		const response = await POST(crossOrigin, context);

		expect([400, 403]).toContain(response.status);
		expect(mocks.createSchedule).not.toHaveBeenCalled();
	});

	it("예약 취소는 204이고 scheduleId가 없으면 400이다", async () => {
		mocks.cancelSchedule.mockResolvedValue(undefined);

		const ok = await DELETE(request("DELETE", "?scheduleId=sched-1"), context);
		const bad = await DELETE(request("DELETE"), context);

		expect(ok.status).toBe(204);
		expect(mocks.cancelSchedule).toHaveBeenCalledWith({ scheduleId: "sched-1", entryId });
		expect(bad.status).toBe(400);
	});
});
