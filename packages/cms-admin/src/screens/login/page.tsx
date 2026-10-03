import { adminHref } from "@bh2980/cms/client";
import { auth, authProviders, isAllowedAdminId, isDevAuthBypassEnabled, signIn, signOut } from "@bh2980/cms/runtime";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";

export default async function AdminLoginPage() {
	if (isDevAuthBypassEnabled()) {
		redirect(adminHref() as Route);
	}

	const session = await auth();
	const accountId = session?.user?.accountId;

	// 이미 관리자로 로그인했으면 바로 대시보드로 간다.
	if (accountId && isAllowedAdminId(accountId)) {
		redirect(adminHref() as Route);
	}

	const isUnauthorizedUser = Boolean(accountId && !isAllowedAdminId(accountId));
	const providers = authProviders();
	// 로그인 방식이 하나면 안내 문구에 그 이름을 쓴다(예: "GitHub 관리자 계정").
	const providerName = providers.length === 1 ? `${providers[0]?.name} ` : "";

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">CMS 관리자</CardTitle>
					<CardDescription>승인된 {providerName}관리자 계정으로 로그인해 주세요.</CardDescription>
				</CardHeader>
				<CardContent>
					{isUnauthorizedUser ? (
						<Alert variant="danger" layout="stack" className="text-center">
							<AlertTitle className="text-xs">접근 권한이 없습니다</AlertTitle>
							<AlertDescription className="mt-1 text-xs">
								로그인한 {providerName}계정 {accountId}에는 관리자 권한이 없습니다.
							</AlertDescription>
							<form
								action={async () => {
									"use server";
									await signOut({ redirectTo: adminHref("/login") });
								}}
								className="mt-3"
							>
								<Button type="submit" variant="link" size="xs">
									로그아웃
								</Button>
							</form>
						</Alert>
					) : (
						<div className="flex flex-col gap-2">
							{providers.map((provider) => (
								<form
									key={provider.id}
									action={async () => {
										"use server";
										await signIn(provider.id, { redirectTo: adminHref() });
									}}
								>
									<Button type="submit" className="w-full">
										{provider.label}
									</Button>
								</form>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
