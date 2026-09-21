import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, NextAuthGateway, isAllowedAdminId } from "../auth-gateway";

vi.mock("../auth-config", () => ({
	auth: vi.fn(),
	handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { auth } from "../auth-config";

describe("M2-BE-1 AuthGateway Contract", () => {
	const originalAdminId = process.env.CMS_ADMIN_GITHUB_ID;
	const originalSchedulerToken = process.env.CMS_SCHEDULER_TOKEN;

	beforeEach(() => {
		vi.resetAllMocks();
		process.env.CMS_ADMIN_GITHUB_ID = "12345678";
		process.env.CMS_SCHEDULER_TOKEN = "secret-scheduler-token";
	});

	afterAll(() => {
		process.env.CMS_ADMIN_GITHUB_ID = originalAdminId;
		process.env.CMS_SCHEDULER_TOKEN = originalSchedulerToken;
	});

	it("isAllowedAdminId validates against CMS_ADMIN_GITHUB_ID correctly", () => {
		expect(isAllowedAdminId("12345678")).toBe(true);
		expect(isAllowedAdminId("87654321")).toBe(false);
		expect(isAllowedAdminId("")).toBe(false);
		expect(isAllowedAdminId(undefined)).toBe(false);
	});

	it("throws unauthorized when no session exists", async () => {
		vi.mocked(auth).mockResolvedValue(null as any);
		const gateway = new NextAuthGateway();

		await expect(gateway.verifyAdmin()).rejects.toThrow(AuthError);
		try {
			await gateway.verifyAdmin();
		} catch (err) {
			expect((err as AuthError).code).toBe("unauthorized");
		}
	});

	it("throws unauthorized when session user has no githubId", async () => {
		vi.mocked(auth).mockResolvedValue({
			user: { name: "attacker" },
		} as any);
		const gateway = new NextAuthGateway();

		await expect(gateway.verifyAdmin()).rejects.toThrow(AuthError);
		try {
			await gateway.verifyAdmin();
		} catch (err) {
			expect((err as AuthError).code).toBe("unauthorized");
		}
	});

	it("throws forbidden when session user githubId does not match CMS_ADMIN_GITHUB_ID", async () => {
		vi.mocked(auth).mockResolvedValue({
			user: { githubId: "99999999", name: "other-user" },
		} as any);
		const gateway = new NextAuthGateway();

		await expect(gateway.verifyAdmin()).rejects.toThrow(AuthError);
		try {
			await gateway.verifyAdmin();
		} catch (err) {
			expect((err as AuthError).code).toBe("forbidden");
		}
	});

	it("returns AuthContext when session user githubId matches CMS_ADMIN_GITHUB_ID", async () => {
		vi.mocked(auth).mockResolvedValue({
			user: { id: "12345678", githubId: "12345678", name: "admin-user" },
		} as any);
		const gateway = new NextAuthGateway();

		const result = await gateway.verifyAdmin();
		expect(result).toEqual({
			userId: "12345678",
			githubId: "12345678",
			isAdmin: true,
		});
	});

	it("authorizeExecutor returns false when scheduler token is missing or incorrect", () => {
		const gateway = new NextAuthGateway();
		expect(gateway.authorizeExecutor()).toBe(false);
		expect(gateway.authorizeExecutor("wrong-token")).toBe(false);
		expect(gateway.authorizeExecutor("secret-scheduler-token")).toBe(true);

		delete process.env.CMS_SCHEDULER_TOKEN;
		expect(gateway.authorizeExecutor("secret-scheduler-token")).toBe(false);
	});
});
