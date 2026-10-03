import { describe, expect, it, vi } from "vitest";
import { CMS_AUTH_BASE_PATH } from "../../../server/define";
import { githubAuthConfig } from "../auth-config";
import { githubAuth } from "../github";

// NextAuth 본체는 Next 서버 모듈을 읽으므로 설정 모양만 본다.
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/github", () => ({ default: (options: object) => ({ id: "github", ...options }) }));

const credentials = { clientId: "id", clientSecret: "secret", adminIds: ["1"] };

describe("GitHub 로그인 경로", () => {
	it("로그인 API는 기본으로 관리자 API 아래(`/api/cms/auth`)이고, 예전 경로를 고를 수 있다", () => {
		expect(githubAuth(credentials).create({ loginPath: "/admin/login" }).basePath).toBe(CMS_AUTH_BASE_PATH);
		expect(githubAuth({ ...credentials, basePath: "/api/auth/" }).create({ loginPath: "/admin/login" }).basePath).toBe(
			"/api/auth",
		);
	});

	it("NextAuth 설정에 로그인 API 경로와 관리자 로그인 화면 주소를 넣는다", () => {
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/studio/login",
		});
		expect(config.basePath).toBe("/api/cms/auth");
		expect(config.pages?.signIn).toBe("/studio/login");
	});
});
