import { redirect } from "next/navigation";
import { auth, signIn } from "@/cms/adapters/auth";

export default async function AdminLoginPage() {
	const session = await auth();
	if (session?.user?.githubId) {
		redirect("/admin");
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-bold tracking-tight text-white">CMS 관리자</h1>
					<p className="mt-2 text-sm text-neutral-400">
						승인된 GitHub 관리자 계정으로 로그인해주세요.
					</p>
				</div>

				<form
					action={async () => {
						"use server";
						await signIn("github", { redirectTo: "/admin" });
					}}
					className="flex flex-col gap-4"
				>
					<button
						type="submit"
						className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 focus:ring-offset-neutral-900"
					>
						GitHub으로 로그인
					</button>
				</form>
			</div>
		</div>
	);
}
