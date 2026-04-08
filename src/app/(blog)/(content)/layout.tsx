import Footer from "@/components/footer";
import Navigation from "@/components/navigation.client";
import { getAdminContext } from "@/libs/admin/context";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const adminContext = await getAdminContext();

	return (
		<>
			<Navigation
				canManage={adminContext.canManage}
				className="sticky top-0 z-10 border-b bg-slate-50/50 backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/50"
			/>
			<main className="flex-1">{children}</main>
			<Footer />
		</>
	);
}
