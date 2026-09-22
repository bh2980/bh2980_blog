import { beforeEach, describe, expect, it, vi } from "vitest";

const dm = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn() }));
const access = vi.hoisted(() => ({ granted: true, status: 401 as 401 | 403 }));
const keystatic = vi.hoisted(() => ({ remotePreview: false }));

vi.mock("next/headers", () => ({
	draftMode: async () => ({ enable: dm.enable, disable: dm.disable, isEnabled: false }),
}));

vi.mock("@/libs/admin/preview-access", () => ({
	checkPreviewAccess: async () => (access.granted ? { granted: true } : { granted: false, status: access.status }),
}));

vi.mock("@/keystatic/libs/runtime", () => ({
	isRemotePreviewEnabled: () => keystatic.remotePreview,
}));

import { GET } from "../start/route";

const request = (query: string) => new Request(`https://example.com/preview/start${query}`);

beforeEach(() => {
	dm.enable.mockReset();
	access.granted = true;
	access.status = 401;
	keystatic.remotePreview = false;
});

describe("M7-FE-1 /preview/start 게이트", () => {
	it("to 파라미터가 없으면 400이다", async () => {
		const response = await GET(request(""));

		expect(response.status).toBe(400);
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("외부 origin으로의 이동은 400이고 draftMode를 켜지 않는다", async () => {
		const response = await GET(request("?to=https://evil.example.com/steal"));

		expect(response.status).toBe(400);
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("해석할 수 없는 to 값은 500이 아니라 400이다", async () => {
		const response = await GET(request("?to=%2F%2F%5B"));

		expect(response.status).toBe(400);
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("세션이 없으면 401이고 draftMode를 켜지 않는다", async () => {
		access.granted = false;
		access.status = 401;

		const response = await GET(request("?to=/posts/hello&branch=preview"));

		expect(response.status).toBe(401);
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("관리자가 아니면 403이고 draftMode를 켜지 않는다", async () => {
		access.granted = false;
		access.status = 403;

		const response = await GET(request("?to=/posts/hello&branch=preview"));

		expect(response.status).toBe(403);
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("세션이 있고 원격 미리보기가 꺼져 있으면 그대로 이동만 한다", async () => {
		const response = await GET(request("?to=/posts/hello"));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://example.com/posts/hello");
		expect(dm.enable).not.toHaveBeenCalled();
	});

	it("세션이 있고 원격 미리보기가 켜져 있으면 draftMode를 켜고 branch 쿠키를 심는다", async () => {
		keystatic.remotePreview = true;

		const response = await GET(request("?to=/posts/hello&branch=preview"));

		expect(response.status).toBe(307);
		expect(dm.enable).toHaveBeenCalledTimes(1);
		expect(response.headers.get("set-cookie")).toContain("ks-branch=preview");
	});

	it("원격 미리보기에서 branch가 없으면 400이고 draftMode를 켜지 않는다", async () => {
		keystatic.remotePreview = true;

		const response = await GET(request("?to=/posts/hello"));

		expect(response.status).toBe(400);
		expect(dm.enable).not.toHaveBeenCalled();
	});
});
