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
			<Navigation initialCanManage={adminContext.canManage} className="absolute top-0 z-10 w-full bg-transparent" />
			<main className="flex flex-1 flex-col">{children}</main>
		</>
	);
}
