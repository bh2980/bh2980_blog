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
	return String(githubId).trim() === expected.trim();
}

export class NextAuthGateway implements AuthGateway {
	async verifyAdmin(): Promise<AuthContext> {
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
