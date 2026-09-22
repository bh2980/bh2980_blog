import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/cms/adapters/auth", () => ({
	AuthError: class AuthError extends Error {
		constructor(
			public readonly code: "unauthorized" | "forbidden",
			message: string,
		) {
			super(message);
		}
	},
	authGateway: { verifyAdmin: () => mockVerifyAdmin() },
}));

import { AuthError } from "@/cms/adapters/auth";
import { canPreview, checkPreviewAccess } from "../preview-access";

beforeEach(() => {
	mockVerifyAdmin.mockReset();
});

describe("M7-FE-1 미리보기 접근 판정", () => {
	it("관리자 세션이 있으면 허용한다", async () => {
		mockVerifyAdmin.mockResolvedValue({ userId: "1", githubId: "1", isAdmin: true });

		await expect(checkPreviewAccess()).resolves.toEqual({ granted: true });
		await expect(canPreview()).resolves.toBe(true);
	});

	it("세션이 없으면 401로 거부한다", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));

		await expect(checkPreviewAccess()).resolves.toEqual({ granted: false, status: 401 });
		await expect(canPreview()).resolves.toBe(false);
	});

	it("관리자가 아니면 403으로 거부한다", async () => {
		mockVerifyAdmin.mockRejectedValue(new AuthError("forbidden", "Forbidden: not an authorized admin"));

		await expect(checkPreviewAccess()).resolves.toEqual({ granted: false, status: 403 });
	});

	it("인증과 무관한 오류는 권한 문제로 감추지 않고 그대로 올린다", async () => {
		mockVerifyAdmin.mockRejectedValue(new Error("session store unavailable"));

		await expect(checkPreviewAccess()).rejects.toThrow("session store unavailable");
	});
});
