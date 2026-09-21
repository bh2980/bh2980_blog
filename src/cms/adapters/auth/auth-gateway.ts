import { auth } from "./auth-config";

export interface AuthContext {
	userId: string;
	githubId: string;
	isAdmin: boolean;
}

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

export function isAllowedAdminId(githubId: string | undefined | null): boolean {
	const expected = process.env.CMS_ADMIN_GITHUB_ID;
	if (!expected || !githubId) {
		return false;
	}

	// Canonical decimal string normalization: strictly /^\d+$/
	const trimmedTarget = String(githubId).trim();
	const trimmedExpected = expected.trim();

	if (!/^\d+$/.test(trimmedTarget) || !/^\d+$/.test(trimmedExpected)) {
		return false;
	}

	// Normalize leading zeros away
	const normTarget = BigInt(trimmedTarget).toString();
	const normExpected = BigInt(trimmedExpected).toString();

	return normTarget === normExpected;
}

/**
 * 로컬 개발환경 한정 인증 우회 여부.
 * NODE_ENV=development 이면서 CMS_DEV_AUTH_BYPASS=1 일 때만 true.
 * production 에서는 플래그가 있어도 무시한다 (fail-closed).
 */
export function isDevAuthBypassEnabled(): boolean {
	return process.env.NODE_ENV === "development" && process.env.CMS_DEV_AUTH_BYPASS === "1";
}

let devBypassWarned = false;

export class NextAuthGateway implements AuthGateway {
	async verifyAdmin(): Promise<AuthContext> {
		if (isDevAuthBypassEnabled()) {
			if (!devBypassWarned) {
				devBypassWarned = true;
			console.warn("[cms-auth] DEV AUTH BYPASS enabled (development only, never use in production)");
			}
			const devId = process.env.CMS_ADMIN_GITHUB_ID?.trim() || "local-dev";
			return { userId: devId, githubId: devId, isAdmin: true };
		}

		const session = await auth();

		if (!session?.user?.githubId) {
			throw new AuthError("unauthorized", "Authentication required");
		}

		const githubId = String(session.user.githubId);
		if (!isAllowedAdminId(githubId)) {
			throw new AuthError("forbidden", "Forbidden: not an authorized admin");
		}

		return {
			userId: session.user.id || githubId,
			githubId,
			isAdmin: true,
		};
	}

	authorizeExecutor(token?: string | null): boolean {
		const expected = process.env.CMS_SCHEDULER_TOKEN;
		if (!expected || !token) {
			return false;
		}
		return token.trim() === expected.trim();
	}
}

export const authGateway = new NextAuthGateway();
