import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ granted: true, status: 401 as 401 | 403 }));

vi.mock("@/libs/admin/preview-access", () => ({
	checkPreviewAccess: async () => (access.granted ? { granted: true } : { granted: false, status: access.status }),
}));

import { GET } from "../start/route";

beforeEach(() => {
	access.granted = true;
	access.status = 401;
});

describe("M9-BE-3 /preview/start 계약 (Keystatic 제거 후)", () => {
	it("세션이 없으면 401이고 아무 부작용이 없다", async () => {
		access.granted = false;
		access.status = 401;

		const response = await GET();

		expect(response.status).toBe(401);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("관리자가 아니면 403이고 아무 부작용이 없다", async () => {
		access.granted = false;
		access.status = 403;

		const response = await GET();

		expect(response.status).toBe(403);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("관리자 세션이 있으면 410 Gone이고 리다이렉트·쿠키를 만들지 않는다", async () => {
		const response = await GET();

		expect(response.status).toBe(410);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("set-cookie")).toBeNull();
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
