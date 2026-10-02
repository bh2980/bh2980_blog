import type { AuthAdapter, CmsAuth } from "../../server/define";
import type { createGithubNextAuth } from "./auth-config";
import { isAllowedAdminId, isDevAuthBypassEnabled } from "./auth-gateway";

export interface GithubAuthOptions {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** 관리자 GitHub 숫자 ID. 비어 있으면 아무도 관리자가 아니다. */
	readonly adminIds: readonly (string | undefined)[];
	/** 로컬 개발에서 로그인 없이 관리자로 본다. `NODE_ENV=development`일 때만 효과가 있다. */
	readonly devBypass?: boolean;
}

type NextAuthResult = ReturnType<typeof createGithubNextAuth>;

/**
 * GitHub OAuth(NextAuth) 관리자 로그인. NextAuth는 로그인 기능을 처음 쓸 때 불러온다
 * (저장소만 쓰는 코드·명령줄 도구가 next-auth를 읽지 않게).
 */
export function githubAuth(options: GithubAuthOptions): AuthAdapter {
	return {
		name: "github",
		create: (): CmsAuth => {
			let nextAuth: Promise<NextAuthResult> | undefined;
			const load = () => {
				nextAuth ??= import("./auth-config").then((module) => module.createGithubNextAuth(options));
				return nextAuth;
			};
			return {
				handlers: {
					GET: async (request) =>
						(await load()).handlers.GET(request as Parameters<NextAuthResult["handlers"]["GET"]>[0]),
					POST: async (request) =>
						(await load()).handlers.POST(request as Parameters<NextAuthResult["handlers"]["POST"]>[0]),
				},
				session: async () => (await load()).auth(),
				signIn: async (provider = "github", signInOptions) => (await load()).signIn(provider, signInOptions),
				signOut: async (signOutOptions) => (await load()).signOut(signOutOptions),
				isAdmin: (userId) => isAllowedAdminId(userId, options.adminIds),
				get devBypass() {
					return isDevAuthBypassEnabled(options.devBypass);
				},
				devUserId: options.adminIds.find((id) => id?.trim())?.trim() || "local-dev",
			};
		},
	};
}
