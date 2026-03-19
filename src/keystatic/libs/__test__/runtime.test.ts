import { afterEach, describe, expect, it, vi } from "vitest";
import { isRemotePreviewEnabled, shouldHideDraftContent, shouldUseRemotePreview } from "../runtime";

describe("keystatic runtime", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("development에서는 remote preview를 비활성화한다", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		expect(isRemotePreviewEnabled()).toBe(false);
		expect(shouldUseRemotePreview({ preview: { branch: "docs/test", token: "token" } })).toBe(false);
		expect(shouldHideDraftContent()).toBe(false);
	});

	it("production에서는 GitHub Keystatic 구성이 있으면 remote preview를 활성화한다", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		expect(isRemotePreviewEnabled()).toBe(true);
		expect(shouldUseRemotePreview({ preview: { branch: "docs/test", token: "token" } })).toBe(true);
		expect(shouldHideDraftContent()).toBe(true);
		expect(shouldHideDraftContent({ preview: { branch: "docs/test", token: "token" } })).toBe(false);
	});

	it("production이어도 GitHub Keystatic 구성이 없으면 remote preview를 비활성화한다", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "");

		expect(isRemotePreviewEnabled()).toBe(false);
		expect(shouldUseRemotePreview({ preview: { branch: "docs/test", token: "token" } })).toBe(false);
	});
});
