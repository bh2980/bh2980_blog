import { afterEach, describe, expect, it, vi } from "vitest";
import { hasVerifiedKeystaticSession } from "../keystatic-auth";

const makeCookieStore = (cookies: Partial<Record<string, string>>) => ({
	get: (name: string) => {
		const value = cookies[name];
		return value === undefined ? undefined : { value };
	},
});

describe("keystatic auth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("local mode에서는 true를 반환한다", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const cookieStore = makeCookieStore({});

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(true);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("access token 쿠키가 없으면 false를 반환한다", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const cookieStore = makeCookieStore({});

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("access token 쿠키가 유효하면 true를 반환한다", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "access-token" });

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(true);
	});

	it("access token 쿠키가 있어도 repo 접근이 거절되면 false를 반환한다", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "invalid-token" });

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(false);
	});

	it("빈 문자열 access token은 false로 처리한다", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "" });

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("검증 요청 중 예외가 발생하면 false를 반환한다", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_OWNER", "bh2980");
		vi.stubEnv("NEXT_PUBLIC_KEYSTATIC_REPO", "bh2980_blog");

		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "access-token" });

		await expect(hasVerifiedKeystaticSession(cookieStore)).resolves.toBe(false);
	});
});
