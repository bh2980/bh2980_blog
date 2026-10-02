import { redirect } from "next/navigation";
import { auth, isAllowedAdminId, isDevAuthBypassEnabled, signIn, signOut } from "@/cms/adapters/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminLoginPage() {
	if (isDevAuthBypassEnabled()) {
		redirect("/admin");
	}

	const session = await auth();
	const currentGithubId = session?.user?.githubId;

	// If already logged in AND authorized as admin, go straight to dashboard
	if (currentGithubId && isAllowedAdminId(currentGithubId)) {
		redirect("/admin");
	}

	const isUnauthorizedUser = Boolean(currentGithubId && !isAllowedAdminId(currentGithubId));

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">CMS 관리자</CardTitle>
					<CardDescription>승인된 GitHub 관리자 계정으로 로그인해주세요.</CardDescription>
				</CardHeader>
				<CardContent>
					{isUnauthorizedUser ? (
						<Alert variant="danger" layout="stack" className="text-center">
							<AlertTitle className="text-xs">접근 권한이 없습니다 (403 Forbidden)</AlertTitle>
							<AlertDescription className="mt-1 text-xs">
								로그인된 GitHub ID({currentGithubId})는 관리자 권한이 없습니다.
							</AlertDescription>
							<form
								action={async () => {
									"use server";
									await signOut({ redirectTo: "/admin/login" });
								}}
								className="mt-3"
							>
								<Button type="submit" variant="link" size="xs">
									로그아웃
								</Button>
							</form>
						</Alert>
					) : (
						<form
							action={async () => {
								"use server";
								await signIn("github", { redirectTo: "/admin" });
							}}
						>
							<Button type="submit" className="w-full">
								GitHub으로 로그인
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
