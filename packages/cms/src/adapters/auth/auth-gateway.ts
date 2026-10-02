import { timingSafeEqual } from "node:crypto";
import type { AuthContext, CmsAuth } from "../../server/define";

export type { AuthContext } from "../../server/define";

export interface AuthGateway {
	verifyAdmin(): Promise<AuthContext>;
	authorizeExecutor(token?: string | null): boolean;
}

export class AuthError extends Error {
	constructor(
		public readonly code: "unauthorized" | "forbidden",
		message: string,
	) {
		super(message);
		this.name = "AuthError";
	}
}

/** GitHub 숫자 ID가 관리자 목록에 있는가. 앞의 0은 무시하고, 숫자가 아닌 값은 거부한다. */
export function isAllowedAdminId(
	githubId: string | undefined | null,
	adminIds: readonly (string | undefined)[],
): boolean {
	const target = String(githubId ?? "").trim();
	if (!/^\d+$/.test(target)) return false;
	const normalized = BigInt(target).toString();
	return adminIds.some((id) => {
		const expected = id?.trim() ?? "";
		return /^\d+$/.test(expected) && BigInt(expected).toString() === normalized;
	});
}

/**
 * 로컬 개발환경 한정 인증 우회 여부. 설정이 켜도 `NODE_ENV=development`일 때만 true다.
 * production 에서는 켜져 있어도 무시한다(fail-closed).
 */
export function isDevAuthBypassEnabled(enabled: boolean | undefined): boolean {
	return enabled === true && process.env.NODE_ENV === "development";
}

let devBypassWarned = false;

/** 관리자 API·화면의 인증(§10.2)과 예약 실행기 토큰 확인. 로그인 방식은 서버 설정의 `auth`가 정한다. */
export class CmsAuthGateway implements AuthGateway {
	constructor(
		private readonly getAuth: () => CmsAuth,
		private readonly getSchedulerToken: () => string | undefined,
	) {}

	async verifyAdmin(): Promise<AuthContext> {
		const cmsAuth = this.getAuth();
		if (cmsAuth.devBypass) {
			if (!devBypassWarned) {
				devBypassWarned = true;
				console.warn("[cms-auth] DEV AUTH BYPASS enabled (development only, never use in production)");
			}
			return { userId: cmsAuth.devUserId, githubId: cmsAuth.devUserId, isAdmin: true };
		}

		const session = await cmsAuth.session();
		if (!session?.user?.githubId) {
			throw new AuthError("unauthorized", "Authentication required");
		}

		const githubId = String(session.user.githubId);
		if (!cmsAuth.isAdmin(githubId)) {
			throw new AuthError("forbidden", "Forbidden: not an authorized admin");
		}

		return { userId: session.user.id || githubId, githubId, isAdmin: true };
	}

	authorizeExecutor(token?: string | null): boolean {
		const expected = this.getSchedulerToken()?.trim();
		const provided = token?.trim();
		if (!expected || !provided || provided.length !== expected.length) {
			return false;
		}

		// M7-SEC-1: 스케줄러 라우트(`schedules/due`, `schedules/[id]/publish`)와 동일하게
		// 길이 선검사 + 타이밍 안전 비교를 쓴다. 이전 구현은 `===` 였다.
		try {
			return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
		} catch {
			return false;
		}
	}
}
