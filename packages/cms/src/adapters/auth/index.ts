import { getCmsAuth } from "../../container";
import { cmsServerConfig } from "../../server/resolved";
import { type AuthGateway, CmsAuthGateway } from "./auth-gateway";

/**
 * 관리자 로그인 실행 API. 서버 설정(`cms.server.ts`)의 `auth`로 만든 연결을 쓴다.
 * 로그인 방식을 고르는 쪽(`githubAuth`)은 `@bh2980/cms/server`에 있다.
 */
export { type AuthContext, AuthError, type AuthGateway } from "./auth-gateway";

export const authGateway: AuthGateway = new CmsAuthGateway(getCmsAuth, () => cmsServerConfig.schedulerToken);

/** `/api/auth/[...nextauth]` 라우트 처리기. */
export const handlers = {
	GET: (request: Request) => getCmsAuth().handlers.GET(request),
	POST: (request: Request) => getCmsAuth().handlers.POST(request),
};

/** 지금 세션. 없으면 `null`. */
export const auth = () => getCmsAuth().session();
export const signIn = (provider?: string, options?: { redirectTo?: string }) => getCmsAuth().signIn(provider, options);
export const signOut = (options?: { redirectTo?: string }) => getCmsAuth().signOut(options);
export const isAllowedAdminId = (userId: string | null | undefined) => getCmsAuth().isAdmin(userId);
export const isDevAuthBypassEnabled = () => getCmsAuth().devBypass;
