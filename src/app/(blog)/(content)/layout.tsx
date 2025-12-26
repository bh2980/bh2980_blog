import { Fragment } from "react";
import Navigation from "@/components/layout-navigation";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<Fragment>
			<Navigation className="bg-white border-b dark:border-gray-800 border-gray-200 sticky top-0 z-10 dark:bg-gray-950 " />
			<main className="flex-1">{children}</main>
		</Fragment>
	);
}
