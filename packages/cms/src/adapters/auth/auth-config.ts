import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			githubId: string;
		} & DefaultSession["user"];
	}

	interface User {
		githubId?: string;
	}
}

export const authConfig: NextAuthConfig = {
	providers: [
		GitHub({
			clientId: process.env.AUTH_GITHUB_ID,
			clientSecret: process.env.AUTH_GITHUB_SECRET,
			profile(profile) {
				const numericId = String(profile.id);
				return {
					id: numericId,
					githubId: numericId,
					name: profile.name ?? profile.login,
					email: profile.email,
					image: profile.avatar_url,
				};
			},
		}),
	],
	session: {
		strategy: "jwt",
		maxAge: 28_800, // 8 hours (rolling)
	},
	callbacks: {
		async jwt({ token, user, profile }) {
			if (profile?.id != null) {
				token.githubId = String(profile.id);
			} else if (user?.githubId != null) {
				token.githubId = user.githubId;
			}
			return token;
		},
		async session({ session, token }) {
			if (token.githubId) {
				session.user.githubId = token.githubId as string;
				session.user.id = token.githubId as string;
			}
			return session;
		},
	},
	pages: {
		signIn: "/admin/login",
	},
	trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
