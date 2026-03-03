import { cookies } from "next/headers";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation.client";
import { hasVerifiedKeystaticSession } from "@/libs/admin/keystatic-auth";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const canManage = await hasVerifiedKeystaticSession(await cookies());

	return (
		<>
			<Navigation
				canManage={canManage}
				className="sticky top-0 z-10 border-b bg-slate-50/50 backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/50"
			/>
			<main className="flex-1">{children}</main>
			<Footer />
		</>
	);
}
