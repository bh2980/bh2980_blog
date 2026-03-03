import { cookies } from "next/headers";
import { Fragment } from "react";
import Navigation from "@/components/navigation.client";
import { hasKeystaticSession } from "@/libs/admin/keystatic-auth";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const canManage = hasKeystaticSession(await cookies());

	return (
		<Fragment>
			<Navigation canManage={canManage} className="absolute top-0 z-10 w-full bg-transparent" />
			<main className="flex flex-1 flex-col">{children}</main>
		</Fragment>
	);
}
