import { Fragment } from "react";
import Navigation from "@/components/navigation.client";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<Fragment>
			<Navigation className="absolute top-0 z-10 w-full bg-transparent" />
			<main className="flex flex-1 flex-col">{children}</main>
		</Fragment>
	);
}
