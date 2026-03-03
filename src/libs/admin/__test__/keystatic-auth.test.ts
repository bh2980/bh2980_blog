import { describe, expect, it } from "vitest";
import { hasKeystaticSession } from "../keystatic-auth";

const makeCookieStore = (cookies: Partial<Record<string, string>>) => ({
	get: (name: string) => {
		const value = cookies[name];
		return value === undefined ? undefined : { value };
	},
});

describe("keystatic auth", () => {
	it("access token 쿠키가 있으면 true를 반환한다", () => {
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "access-token" });
		expect(hasKeystaticSession(cookieStore)).toBe(true);
	});

	it("refresh token 쿠키만 있어도 true를 반환한다", () => {
		const cookieStore = makeCookieStore({ "keystatic-gh-refresh-token": "refresh-token" });
		expect(hasKeystaticSession(cookieStore)).toBe(true);
	});

	it("두 쿠키 모두 없으면 false를 반환한다", () => {
		const cookieStore = makeCookieStore({});
		expect(hasKeystaticSession(cookieStore)).toBe(false);
	});

	it("빈 문자열 토큰은 false로 처리한다", () => {
		const cookieStore = makeCookieStore({ "keystatic-gh-access-token": "" });
		expect(hasKeystaticSession(cookieStore)).toBe(false);
	});
});
